"use client";

import { useEffect, useRef, useState } from "react";

type Role = "user" | "agent" | "error";

type ChatMessage = {
  id: number;
  role: Role;
  text: string;
};

function renderMessageText(text: string) {
  const parts = text.split(/(```[\s\S]*?```)/g);
  return parts.map((part, i) => {
    if (part.startsWith("```") && part.endsWith("```")) {
      const contentLines = part.slice(3, -3).split("\n");
      const language = contentLines[0].trim();
      const code = contentLines.slice(1).join("\n");

      return (
        <div key={i} className="my-2 overflow-hidden rounded-md border border-zinc-700 bg-black">
          <div className="flex items-center justify-between bg-zinc-800 px-3 py-1.5 text-xs text-zinc-400">
            <span>{language || "code"}</span>
            <div className="flex gap-3">
              <button onClick={() => navigator.clipboard.writeText(code)} className="hover:text-white transition-colors">
                Copy
              </button>
              <button onClick={() => {
                const blob = new Blob([code], { type: "text/plain" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                let ext = language || "txt";
                if (ext === "javascript") ext = "js";
                if (ext === "typescript") ext = "ts";
                if (ext === "python") ext = "py";
                a.download = `file.${ext}`;
                a.click();
                URL.revokeObjectURL(url);
              }} className="hover:text-white transition-colors">
                Download
              </button>
            </div>
          </div>
          <pre className="overflow-x-auto p-3 text-xs text-zinc-300">
            <code>{code}</code>
          </pre>
        </div>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

export default function Chat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streaming, setStreaming] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const idRef = useRef(0);
  const continuationRef = useRef<string | null>(null);
  const eventCountRef = useRef(0);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, streaming]);

  function addMessage(role: Role, text: string) {
    const id = ++idRef.current;
    setMessages((prev) => [...prev, { id, role, text }]);
  }

  async function parseError(res: Response): Promise<string> {
    try {
      const body = await res.json();
      if (body && (body.error || body.code)) {
        return String(body.error ?? body.code);
      }
    } catch {
      // not JSON — fall through to status text
    }
    return `${res.status} ${res.statusText}`;
  }

  async function sendTurn(id: string | null, text: string): Promise<string> {
    let res: Response;
    if (!id) {
      // First message: create the session and dispatch the turn in one call.
      // The eve channel requires a JSON body on POST /eve/v1/session.
      res = await fetch("/eve/v1/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      if (!res.ok) throw new Error(await parseError(res));
      const body = (await res.json()) as { sessionId?: string; continuationToken?: string };
      if (!body.sessionId) throw new Error("Could not create a chat session.");
      if (body.continuationToken) continuationRef.current = body.continuationToken;
      setSessionId(body.sessionId);
      return body.sessionId;
    }

    // Follow-up: continue the session with the current continuation token.
    const payload: Record<string, unknown> = { message: text };
    if (continuationRef.current) payload.continuationToken = continuationRef.current;
    res = await fetch(`/eve/v1/session/${id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(await parseError(res));
    const body = (await res.json()) as { continuationToken?: string };
    if (body.continuationToken) continuationRef.current = body.continuationToken;
    return id;
  }

  async function streamReply(id: string) {
    const url =
      eventCountRef.current > 0
        ? `/eve/v1/session/${id}/stream?startIndex=${eventCountRef.current}`
        : `/eve/v1/session/${id}/stream`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(await parseError(res));
    if (!res.body) return;

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let acc = "";
    let finished = false;

    setStreaming("");

    const finish = () => {
      if (finished) return;
      finished = true;
      if (acc.trim()) addMessage("agent", acc);
      setStreaming(null);
    };

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          finish();
          break;
        }
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          eventCountRef.current++;
          let ev: { type?: string; data?: { messageDelta?: string; message?: string; continuationToken?: string } };
          try {
            ev = JSON.parse(line);
          } catch {
            continue;
          }
          switch (ev.type) {
            case "message.appended":
              acc += ev.data?.messageDelta ?? "";
              setStreaming(acc);
              break;
            case "message.completed":
              if (typeof ev.data?.message === "string" && ev.data.message) {
                acc = ev.data.message;
                setStreaming(acc);
              }
              break;
            case "turn.failed":
            case "turn.cancelled":
            case "session.failed":
              if (ev.data?.message) addMessage("error", ev.data.message);
              finish();
              return;
            case "billing.error":
              if (ev.data?.message) addMessage("error", ev.data.message);
              break;
            case "session.waiting":
              if (ev.data?.continuationToken) continuationRef.current = ev.data.continuationToken;
              finish();
              return;
            case "turn.completed":
              // Wait for session.waiting (which follows turn.completed and carries continuationToken)
              break;
            case "session.completed":
              finish();
              return;
            default:
              break;
          }
        }
      }
    } catch {
      finish();
    }
  }

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setBusy(true);
    setInput("");
    addMessage("user", text);
    try {
      const id = await sendTurn(sessionId, text);
      await streamReply(id);
    } catch (err) {
      addMessage("error", err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  function newChat() {
    setSessionId(null);
    continuationRef.current = null;
    eventCountRef.current = 0;
    setMessages([]);
    setStreaming(null);
    setInput("");
  }

  return (
    <div className="flex h-[calc(100dvh-12rem)] min-h-[24rem] flex-col">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Chat with AI</h1>
          <p className="text-sm text-zinc-400">
            Ask anything — the AI keeps searching the web until the answer is right.
          </p>
        </div>
        <button
          onClick={newChat}
          disabled={busy}
          className="rounded-lg border border-zinc-700 px-3 py-2 text-sm hover:bg-zinc-900 disabled:opacity-50"
        >
          New chat
        </button>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 space-y-3 overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-900/40 p-4"
      >
        {messages.length === 0 && streaming === null && (
          <p className="text-sm text-zinc-500">
            Send a message below to start chatting.
          </p>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={`max-w-[75%] whitespace-pre-wrap break-words rounded-xl px-3 py-2 text-sm ${
              m.role === "user"
                ? "ml-auto bg-blue-600"
                : m.role === "error"
                  ? "bg-red-950 text-red-300"
                  : "bg-zinc-800"
            }`}
          >
            {renderMessageText(m.text)}
          </div>
        ))}
        {streaming !== null && (
          <div className="max-w-[75%] whitespace-pre-wrap break-words rounded-xl bg-zinc-800 px-3 py-2 text-sm">
            {renderMessageText(streaming)}
            <span className="ml-0.5 inline-block h-4 w-2 animate-pulse bg-zinc-400 align-middle" />
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
        className="mt-4 flex gap-2"
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          placeholder="Ask me anything…"
          rows={1}
          className="flex-1 resize-none rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2.5"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="rounded-lg bg-blue-600 px-5 py-2.5 font-medium hover:bg-blue-500 disabled:opacity-50"
        >
          {busy ? "Thinking…" : "Send"}
        </button>
      </form>
    </div>
  );
}
