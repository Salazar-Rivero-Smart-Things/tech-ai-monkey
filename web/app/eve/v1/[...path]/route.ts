import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createAgentToken } from "@/lib/agent-auth";
import { consumeTokens, getBillingState } from "@/lib/billing/service";
import { resolveCliToken } from "@/lib/cli-tokens";
import { isUnlimited } from "@/lib/entitlements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ path: string[] }> };

interface Caller {
  userId: string;
  email: string | null;
  role: string;
  /** Owner/admin: never metered, never blocked by a paywall. */
  unlimited: boolean;
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function bearerFrom(request: Request): string {
  const header = request.headers.get("authorization") ?? "";
  return header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
}

/**
 * Identify the caller. Two ways in:
 *   1. the browser session cookie (dashboard chat), or
 *   2. an `Authorization: Bearer tai_...` CLI token (`tech-ai login`).
 */
async function resolveCaller(request: Request): Promise<Caller | null> {
  const session = await auth();
  if (session?.user?.id) {
    const { id, email, role } = session.user;
    return {
      userId: id,
      email: email ?? null,
      role: role ?? "user",
      unlimited: isUnlimited({ id, email, role }),
    };
  }

  const bearer = bearerFrom(request);
  if (bearer) {
    const user = await resolveCliToken(bearer);
    if (user) {
      return {
        userId: user.id,
        email: user.email,
        role: user.role,
        unlimited: isUnlimited(user),
      };
    }
  }

  return null;
}

function isTerminalEvent(type: unknown) {
  return [
    "turn.completed",
    "turn.failed",
    "turn.cancelled",
    "session.failed",
    "session.completed",
  ].includes(String(type));
}

async function proxyRequest(request: Request, context: RouteContext) {
  const caller = await resolveCaller(request);
  if (!caller) return jsonError("Not authenticated.", 401);
  const { userId, unlimited } = caller;

  const { path } = await context.params;
  const pathName = path.map(encodeURIComponent).join("/");
  const isMessageRequest =
    request.method === "POST" &&
    path[0] === "session" &&
    path.length <= 2;

  // The owner/admin is never metered and never blocked.
  if (isMessageRequest && !unlimited) {
    const billing = await getBillingState(userId);
    if (billing.totalRemaining <= 0) {
      return jsonError("You are out of tokens. Upgrade or add prepaid tokens to continue.", 402);
    }
  }

  const agentUrl = process.env.EVE_AGENT_URL;
  if (!agentUrl) return jsonError("The AI agent is not configured yet.", 503);

  const rawBody = request.method === "GET" ? undefined : await request.arrayBuffer();
  if (rawBody && rawBody.byteLength > 65_536) {
    return jsonError("Request body is too large.", 413);
  }

  let targetUrl: URL;
  try {
    const base = new URL(agentUrl);
    const basePath = base.pathname.replace(/\/+$/, "");
    targetUrl = new URL(`${basePath}/eve/v1/${pathName}`, base.origin);
    targetUrl.search = new URL(request.url).search;
  } catch {
    return jsonError("EVE_AGENT_URL must be a valid absolute URL.", 500);
  }

  let token: string;
  try {
    token = await createAgentToken(userId);
  } catch {
    return jsonError("The agent signing secret is not configured.", 503);
  }

  let upstream: Response;
  try {
    const headers = new Headers({ authorization: `Bearer ${token}` });
    const contentType = request.headers.get("content-type");
    if (contentType) headers.set("content-type", contentType);
    const accept = request.headers.get("accept");
    if (accept) headers.set("accept", accept);

    upstream = await fetch(targetUrl, {
      method: request.method,
      headers,
      body: rawBody,
      cache: "no-store",
      signal: request.signal,
    });
  } catch {
    return jsonError("Could not reach the AI agent.", 502);
  }

  const headers = new Headers();
  for (const name of ["content-type", "cache-control", "x-eve-stream-version", "x-eve-session-id"]) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }

  const isStream = request.method === "GET" && path.at(-1) === "stream";
  if (!isStream || !upstream.body || !upstream.ok) {
    return new Response(upstream.body, {
      status: upstream.status,
      headers,
    });
  }

  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";
  let usedTokens = 0;
  let charged = false;

  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            if (buffer) controller.enqueue(encoder.encode(buffer));
            controller.close();
            return;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!charged) {
              try {
                const event = JSON.parse(line) as {
                  type?: string;
                  data?: { usage?: { inputTokens?: number; outputTokens?: number } };
                };
                if (event.type === "step.completed") {
                  usedTokens +=
                    Math.max(0, event.data?.usage?.inputTokens ?? 0) +
                    Math.max(0, event.data?.usage?.outputTokens ?? 0);
                }
                if (isTerminalEvent(event.type)) {
                  charged = true;
                  if (usedTokens > 0 && !unlimited) {
                    await consumeTokens(userId, usedTokens, {
                      source: "eve-agent",
                      sessionId: path[1] ?? null,
                    });
                  }
                }
              } catch (error) {
                if (error instanceof SyntaxError) {
                  // Non-JSON lines are passed through unchanged.
                } else {
                  const billing = unlimited
                    ? null
                    : await getBillingState(userId).catch(() => null);
                  const available = billing?.totalRemaining ?? 0;
                  if (!unlimited && available > 0) {
                    await consumeTokens(userId, Math.min(available, usedTokens), {
                      source: "eve-agent",
                      sessionId: path[1] ?? null,
                      partial: true,
                    }).catch(() => undefined);
                  }
                  controller.enqueue(
                    encoder.encode(
                      `${JSON.stringify({
                        type: "billing.error",
                        data: { message: "We could not record this turn's token usage." },
                      })}\n`,
                    ),
                  );
                  await reader.cancel();
                  controller.close();
                  return;
                }
              }
            }

            controller.enqueue(encoder.encode(`${line}\n`));
            if (!charged) continue;
            if (isTerminalEvent(JSON.parse(line).type)) {
              await reader.cancel();
              controller.close();
              return;
            }
          }
        }
      } catch (error) {
        controller.error(error);
      }
    },
    async cancel(reason) {
      await reader.cancel(reason);
    },
  });

  return new Response(stream, { status: upstream.status, headers });
}

export function GET(request: Request, context: RouteContext) {
  return proxyRequest(request, context);
}

export function POST(request: Request, context: RouteContext) {
  return proxyRequest(request, context);
}