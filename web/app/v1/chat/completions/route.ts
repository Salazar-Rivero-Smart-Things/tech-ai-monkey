import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { createAgentToken } from "@/lib/agent-auth";
import { resolveApiCaller } from "@/lib/api-caller";
import { consumeTokens, getBillingState } from "@/lib/billing/service";

// ---------------------------------------------------------------------------
// POST /v1/chat/completions — an OpenAI-compatible Chat Completions endpoint.
//
// This is what lets the Tech AI monkey agent be used as a model in VS Code
// (Chat: Manage Language Models → Add Models → Custom Endpoint), in any other
// OpenAI-compatible client, or from `curl`. A key from Dashboard → API keys is
// sent as:  Authorization: Bearer tai_...
//
// How it works: an OpenAI request is a stateless list of messages, while the
// eve agent is a stateful session with its own tools and memory. So the
// transcript is flattened into the single prompt the agent accepts, a fresh
// session is created per request, and the agent's event stream is translated
// into OpenAI `chat.completion.chunk` SSE.
//
// Note for VS Code: configure the model with "toolCalling": false. VS Code
// would call its own tools, but this agent runs its own tools server-side, so
// it belongs in Ask mode rather than Agent mode.
// ---------------------------------------------------------------------------

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** The only model this instance exposes — the agent picks its own LLM internally. */
const MODEL_ID = "tech-ai-monkey";
const MAX_BODY_BYTES = 1_000_000;

type ChatMessage = { role?: string; content?: unknown };

interface AgentEvent {
  type?: string;
  data?: {
    messageDelta?: string;
    message?: string;
    usage?: { inputTokens?: number; outputTokens?: number };
  };
}

function openaiError(
  message: string,
  status: number,
  type: string,
  code: string | null = null,
) {
  return NextResponse.json(
    { error: { message, type, param: null, code } },
    { status },
  );
}

/** Accept both a plain string and OpenAI's array-of-parts content shape. */
function textOf(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    const parts: string[] = [];
    for (const part of content) {
      if (typeof part === "string") {
        parts.push(part);
      } else if (part && typeof part === "object") {
        const text = (part as { text?: unknown }).text;
        if (typeof text === "string") parts.push(text);
      }
    }
    return parts.join("\n");
  }
  return "";
}

/** Flatten an OpenAI message list into the one prompt the agent understands. */
function buildPrompt(messages: ChatMessage[]): string {
  const system: string[] = [];
  const turns: string[] = [];

  for (const message of messages) {
    const text = textOf(message?.content).trim();
    if (!text) continue;
    switch ((message?.role ?? "user").toLowerCase()) {
      case "system":
      case "developer":
        system.push(text);
        break;
      case "assistant":
        turns.push(`Assistant: ${text}`);
        break;
      case "tool":
        turns.push(`Tool result: ${text}`);
        break;
      default:
        turns.push(`User: ${text}`);
    }
  }

  const blocks: string[] = [];
  if (system.length > 0) blocks.push(system.join("\n\n"));

  if (turns.length === 1) {
    blocks.push(turns[0]);
  } else if (turns.length > 1) {
    blocks.push(`Earlier in this conversation:\n\n${turns.slice(0, -1).join("\n\n")}`);
    blocks.push(
      `Now reply to the final message. Answer only that last message — do not repeat the transcript:\n\n${
        turns[turns.length - 1]
      }`,
    );
  }

  return blocks.join("\n\n").trim();
}

interface Pumped {
  text: string;
  promptTokens: number;
  completionTokens: number;
  errorText: string;
  finished: boolean;
}

/**
 * Read the agent's event stream, optionally re-emitting text deltas as they
 * arrive, and report the final text plus the token usage of the turn.
 */
async function pumpAgentStream(
  upstream: Response,
  onDelta?: (delta: string) => void,
): Promise<Pumped> {
  const reader = upstream.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  let promptTokens = 0;
  let completionTokens = 0;
  let errorText = "";
  let finished = false;

  try {
    while (!finished) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.trim()) continue;
        let event: AgentEvent;
        try {
          event = JSON.parse(line) as AgentEvent;
        } catch {
          continue;
        }

        switch (event.type) {
          case "message.appended": {
            const delta = event.data?.messageDelta ?? "";
            if (delta) {
              text += delta;
              onDelta?.(delta);
            }
            break;
          }
          case "message.completed": {
            const full = event.data?.message;
            if (typeof full === "string" && full) {
              // The completed message is authoritative; emit only the tail we
              // have not already streamed.
              if (full.startsWith(text)) {
                const rest = full.slice(text.length);
                if (rest) onDelta?.(rest);
              }
              text = full;
            }
            break;
          }
          case "step.completed": {
            promptTokens += Math.max(0, event.data?.usage?.inputTokens ?? 0);
            completionTokens += Math.max(0, event.data?.usage?.outputTokens ?? 0);
            break;
          }
          case "turn.failed":
          case "session.failed":
          case "turn.cancelled":
            errorText = event.data?.message ?? "The agent could not finish the turn.";
            finished = true;
            break;
          case "billing.error":
            // Shown to the caller, but the turn continues.
            errorText = event.data?.message ?? errorText;
            break;
          case "turn.completed":
          case "session.completed":
          case "session.waiting":
            finished = true;
            break;
          default:
            break;
        }

        if (finished) break;
      }
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }

  return { text, promptTokens, completionTokens, errorText, finished };
}

export async function POST(request: Request) {
  const caller = await resolveApiCaller(request);
  if (!caller) {
    return openaiError(
      "Invalid API key. Create one under Dashboard → API keys and send it as: Authorization: Bearer tai_...",
      401,
      "invalid_request_error",
      "invalid_api_key",
    );
  }

  // The owner/admin is never metered or blocked. Everyone else must have tokens.
  if (!caller.unlimited) {
    const billing = await getBillingState(caller.userId);
    if (billing.totalRemaining <= 0) {
      return openaiError(
        "You are out of tokens. Upgrade your plan or add prepaid tokens to continue.",
        402,
        "insufficient_quota",
        "insufficient_quota",
      );
    }
  }

  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_BODY_BYTES) {
    return openaiError("Request body is too large.", 413, "invalid_request_error");
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return openaiError("Invalid JSON body.", 400, "invalid_request_error");
  }

  const messages = Array.isArray(body.messages) ? (body.messages as ChatMessage[]) : [];
  const prompt = buildPrompt(messages);
  if (!prompt) {
    return openaiError(
      "Missing 'messages'. Send at least one message with content.",
      400,
      "invalid_request_error",
      "missing_messages",
    );
  }

  const model = typeof body.model === "string" && body.model.trim() ? body.model.trim() : MODEL_ID;
  const wantsStream = body.stream !== false;

  const agentUrl = process.env.EVE_AGENT_URL;
  if (!agentUrl) return openaiError("The AI agent is not configured yet.", 503, "api_error");

  let token: string;
  try {
    token = await createAgentToken(caller.userId, { role: caller.role, email: caller.email });
  } catch {
    return openaiError("The agent signing secret is not configured.", 503, "api_error");
  }

  let origin: string;
  try {
    const base = new URL(agentUrl);
    origin = `${base.origin}${base.pathname.replace(/\/+$/, "")}`;
  } catch {
    return openaiError("EVE_AGENT_URL must be a valid absolute URL.", 500, "api_error");
  }

  // 1) A fresh session, with the flattened transcript as its first message.
  let created: Response;
  try {
    created = await fetch(`${origin}/eve/v1/session`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ message: prompt }),
      cache: "no-store",
      signal: request.signal,
    });
  } catch {
    return openaiError("Could not reach the AI agent.", 502, "api_error");
  }

  if (!created.ok) {
    return openaiError(`The agent returned an error (${created.status}).`, 502, "api_error");
  }

  let sessionId = "";
  try {
    sessionId = ((await created.json()) as { sessionId?: string }).sessionId ?? "";
  } catch {
    // Reported below.
  }
  if (!sessionId) return openaiError("Could not create a chat session.", 502, "api_error");

  // 2) The agent's event stream for that session.
  let upstream: Response;
  try {
    upstream = await fetch(`${origin}/eve/v1/session/${encodeURIComponent(sessionId)}/stream`, {
      headers: { authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: request.signal,
    });
  } catch {
    return openaiError("Could not reach the AI agent.", 502, "api_error");
  }

  if (!upstream.ok || !upstream.body) {
    return openaiError(`The agent stream returned an error (${upstream.status}).`, 502, "api_error");
  }

  const id = `chatcmpl-${randomUUID().replace(/-/g, "")}`;
  const createdAt = Math.floor(Date.now() / 1000);

  const charge = async (promptTokens: number, completionTokens: number) => {
    if (caller.unlimited) return;
    const total = promptTokens + completionTokens;
    if (total <= 0) return;
    await consumeTokens(caller.userId, total, {
      source: "openai-compat",
      sessionId,
    }).catch(() => undefined);
  };

  // --- non-streaming: collect the whole answer, then answer once -------------
  if (!wantsStream) {
    const pumped = await pumpAgentStream(upstream);
    await charge(pumped.promptTokens, pumped.completionTokens);

    if (pumped.errorText) {
      return openaiError(pumped.errorText, 502, "api_error");
    }

    return NextResponse.json({
      id,
      object: "chat.completion",
      created: createdAt,
      model,
      choices: [
        {
          index: 0,
          message: { role: "assistant", content: pumped.text },
          finish_reason: "stop",
        },
      ],
      usage: {
        prompt_tokens: pumped.promptTokens,
        completion_tokens: pumped.completionTokens,
        total_tokens: pumped.promptTokens + pumped.completionTokens,
      },
    });
  }

  // --- streaming: translate the agent stream into OpenAI chunks --------------
  const encoder = new TextEncoder();
  const chunk = (delta: Record<string, unknown>, finishReason: string | null = null) =>
    encoder.encode(
      `data: ${JSON.stringify({
        id,
        object: "chat.completion.chunk",
        created: createdAt,
        model,
        choices: [{ index: 0, delta, finish_reason: finishReason }],
      })}\n\n`,
    );

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(chunk({ role: "assistant", content: "" }));

      try {
        const pumped = await pumpAgentStream(upstream, (delta) => {
          controller.enqueue(chunk({ content: delta }));
        });

        if (pumped.errorText) {
          controller.enqueue(chunk({ content: `\n\n[error] ${pumped.errorText}` }));
        }

        controller.enqueue(chunk({}, "stop"));
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              id,
              object: "chat.completion.chunk",
              created: createdAt,
              model,
              choices: [],
              usage: {
                prompt_tokens: pumped.promptTokens,
                completion_tokens: pumped.completionTokens,
                total_tokens: pumped.promptTokens + pumped.completionTokens,
              },
            })}\n\n`,
          ),
        );
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));

        await charge(pumped.promptTokens, pumped.completionTokens);
      } catch {
        // Tell the client the turn is over even if the agent stream broke.
        controller.enqueue(chunk({}, "stop"));
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } finally {
        controller.close();
      }
    },
    cancel(reason) {
      void upstream.body?.cancel(reason);
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      // Stop any reverse proxy (Cloudflare, nginx) from buffering the stream.
      "x-accel-buffering": "no",
    },
  });
}
