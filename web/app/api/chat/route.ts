import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createAgentToken } from "@/lib/agent-auth";

export const runtime = "nodejs";
export const maxDuration = 60;

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

// The web chat is driven by the eve agent (see /eve/v1/*). This endpoint is a
// thin compatibility shim that forwards to that same cloud-backed agent, so no
// local Ollama model is needed.
export async function POST(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return jsonError("Not authenticated.", 401);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON body.", 400);
  }

  // Accept either { message } or the AI-SDK style { messages: [...] }.
  let text = "";
  if (typeof body.message === "string") {
    text = body.message;
  } else if (Array.isArray(body.messages)) {
    const parts: string[] = [];
    for (const m of body.messages as { role?: string; content?: unknown }[]) {
      const content = typeof m?.content === "string" ? m.content : "";
      if (content) {
        parts.push(m.role === "user" ? content : `${m.role ?? "assistant"}: ${content}`);
      }
    }
    text = parts.join("\n");
  }

  if (!text.trim()) return jsonError("Missing message.", 400);

  const agentUrl = process.env.EVE_AGENT_URL;
  if (!agentUrl) return jsonError("The AI agent is not configured yet.", 503);

  let token: string;
  try {
    token = await createAgentToken(userId);
  } catch {
    return jsonError("The agent signing secret is not configured.", 503);
  }

  const base = new URL(agentUrl);
  const basePath = base.pathname.replace(/\/+$/, "");

  // 1) Create a session and deliver the first message in one call.
  let create: Response;
  try {
    create = await fetch(`${base.origin}${basePath}/eve/v1/session`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ message: text }),
      cache: "no-store",
      signal: req.signal,
    });
  } catch {
    return jsonError("Could not reach the AI agent.", 502);
  }

  if (!create.ok) {
    return jsonError(`Agent error (${create.status}).`, 502);
  }

  let sessionId = "";
  try {
    const json = (await create.json()) as { sessionId?: string };
    sessionId = json.sessionId ?? "";
  } catch {
    // ignore — handled below
  }
  if (!sessionId) return jsonError("Could not create a chat session.", 502);

  // 2) Stream the reply back as Server-Sent Events.
  let upstream: Response;
  try {
    upstream = await fetch(
      `${base.origin}${basePath}/eve/v1/session/${encodeURIComponent(sessionId)}/stream`,
      {
        headers: { authorization: `Bearer ${token}` },
        cache: "no-store",
        signal: req.signal,
      },
    );
  } catch {
    return jsonError("Could not reach the AI agent.", 502);
  }

  if (!upstream.ok || !upstream.body) {
    return jsonError(`Agent stream error (${upstream.status}).`, 502);
  }

  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";
  let done = false;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (payload: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));

      try {
        while (!done) {
          const { done: readDone, value } = await reader.read();
          if (readDone) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.trim()) continue;
            let event: { type?: string; data?: { messageDelta?: string; message?: string } };
            try {
              event = JSON.parse(line);
            } catch {
              continue;
            }

            switch (event.type) {
              case "message.appended":
                if (event.data?.messageDelta) send({ delta: event.data.messageDelta });
                break;
              case "message.completed":
                if (typeof event.data?.message === "string" && event.data.message) {
                  send({ text: event.data.message });
                }
                break;
              case "turn.failed":
              case "billing.error":
                if (event.data?.message) send({ error: event.data.message });
                break;
              case "turn.completed":
              case "session.completed":
              case "session.waiting":
                done = true;
                break;
              default:
                break;
            }
          }
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      } catch {
        controller.close();
      }
    },
    cancel(reason) {
      void reader.cancel(reason);
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  });
}