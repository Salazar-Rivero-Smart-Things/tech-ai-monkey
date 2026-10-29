"use client";

import { useEffect, useRef, useState } from "react";

type Role = "user" | "agent" | "error";

type ChatMessage = {
  id: number;
  role: Role;
  text: string;
  attachment?: { name: string; kind: AttachmentKind };
};

type AttachmentKind = "image" | "video" | "document";

type Attachment = {
  storedAs: string;
  originalName: string;
  kind: AttachmentKind;
  sizeBytes: number;
};

const KIND_ICON: Record<AttachmentKind, string> = { image: "🖼️", video: "🎬", document: "📄" };

const ACCEPTED_FILES =
  ".png,.jpg,.jpeg,.webp,.gif,.mp4,.m4v,.mov,.avi,.mkv,.webm,.wmv,.mpg,.mpeg,.3gp,.ogv,.ts,.mts,.m2ts," +
  ".txt,.md,.markdown,.rtf,.doc,.docx,.pdf,.php,.html,.css,.js,.ts,.json,.sql";

function humanSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

const MARKDOWN_IMAGE = /!\[([^\]]*)\]\((\/[^)\s]+|https?:\/\/[^)\s]+)\)/g;

function renderInline(text: string, keyPrefix: string) {
  const nodes: React.ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(MARKDOWN_IMAGE)) {
    const start = match.index ?? 0;
    if (start > last) nodes.push(text.slice(last, start));
    nodes.push(
      // eslint-disable-next-line @next/next/no-img-element
      <img
        key={`${keyPrefix}-img-${start}`}
        src={match[2]}
        alt={match[1]}
        className="my-2 max-h-80 rounded-lg border border-zinc-700"
        loading="lazy"
      />,
    );
    last = start + match[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes.length ? nodes : [text];
}

function renderMessageText(text: string) {
  const parts = text.split(/(```[\s\S]*?```)/g);
  return parts.map((part, i) => {
    if (part.startsWith("```") && part.endsWith("```")) {
      const contentLines = part.slice(3, -3).split("\n");
      const rawLang = contentLines[0].trim().toLowerCase();
      const code = contentLines.slice(1).join("\n");
      const isPhp = rawLang === "php" || code.includes("<?php");
      const displayLang = isPhp ? "php" : rawLang || "code";

      return (
        <div key={i} className="my-2 overflow-hidden rounded-md border border-zinc-700 bg-black">
          <div className="flex items-center justify-between bg-zinc-800 px-3 py-1.5 text-xs text-zinc-400">
            <span>{displayLang}</span>
            <div className="flex gap-3">
              <button onClick={() => navigator.clipboard.writeText(code)} className="hover:text-white transition-colors">
                Copy
              </button>
              <button onClick={() => {
                const blob = new Blob([code], { type: "text/plain;charset=utf-8" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                let ext = isPhp ? "php" : rawLang || "txt";
                if (ext === "javascript") ext = "js";
                if (ext === "typescript") ext = "ts";
                if (ext === "python") ext = "py";
                a.download = ext === "php" || ext === "html" ? `index.${ext}` : `file.${ext}`;
                a.click();
                URL.revokeObjectURL(url);
              }} className="hover:text-white transition-colors">
                {isPhp ? "Download .php" : "Download"}
              </button>
            </div>
          </div>
          <pre className="overflow-x-auto p-3 text-xs text-zinc-300">
            <code>{code}</code>
          </pre>
        </div>
      );
    }
    return (
      <span key={i}>
        {renderInline(part, `p${i}`).map((node, j) =>
          typeof node === "string" ? <span key={j}>{node}</span> : node,
        )}
      </span>
    );
  });
}

/** Gi opp en tur som ikke sender et eneste tegn på denne tiden. */
const STREAM_IDLE_TIMEOUT_MS = 150_000;
/** Absolutt tak for én tur, uansett aktivitet. */
const STREAM_TOTAL_TIMEOUT_MS = 20 * 60_000;
/** Selve innsendingen skal svare raskt; ellers er agenten tett. */
const SEND_TIMEOUT_MS = 90_000;

type RetryPayload = { raw: string; display: string; attachment?: ChatMessage["attachment"] };

export default function Chat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streaming, setStreaming] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [uploading, setUploading] = useState(false);
  const [retry, setRetry] = useState<RetryPayload | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const idRef = useRef(0);
  const continuationRef = useRef<string | null>(null);
  const eventCountRef = useRef(0);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, streaming]);

  function addMessage(role: Role, text: string, att?: ChatMessage["attachment"]) {
    const id = ++idRef.current;
    setMessages((prev) => [...prev, { id, role, text, attachment: att }]);
  }

  async function uploadFile(file: File) {
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/chat/upload", { method: "POST", body: form });
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        file?: Attachment;
      };
      if (!res.ok || !body.ok || !body.file) {
        throw new Error(body.error || `${res.status} ${res.statusText}`);
      }
      setAttachment(body.file);
    } catch (err) {
      addMessage("error", err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
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
        signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
      }).catch((err: unknown) => {
        throw new Error(
          err instanceof Error && err.name === "TimeoutError"
            ? "Agenten svarte ikke på forespørselen. Prøv igjen."
            : err instanceof Error
              ? err.message
              : "Fikk ikke kontakt med agenten.",
        );
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
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    }).catch((err: unknown) => {
      throw new Error(
        err instanceof Error && err.name === "TimeoutError"
          ? "Agenten svarte ikke på forespørselen. Prøv igjen."
          : err instanceof Error
            ? err.message
            : "Fikk ikke kontakt med agenten.",
      );
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

    // En tur som aldri svarer skal gi en synlig feil med «Prøv igjen», ikke en
    // evig spinner. Watchdogen avbryter strømmen og lar brukeren sende på nytt.
    const abort = new AbortController();
    const startedAt = Date.now();
    let lastActivity = Date.now();
    let timedOut: string | null = null;
    const watchdog = setInterval(() => {
      if (Date.now() - startedAt > STREAM_TOTAL_TIMEOUT_MS) {
        timedOut = "Agenten brukte for lang tid på denne forespørselen.";
      } else if (Date.now() - lastActivity > STREAM_IDLE_TIMEOUT_MS) {
        timedOut = "Agenten sluttet å svare. Du kan prøve igjen.";
      }
      if (timedOut) abort.abort();
    }, 5_000);

    const res = await fetch(url, { signal: abort.signal }).catch((err: unknown) => {
      clearInterval(watchdog);
      throw err;
    });
    if (!res.ok) {
      clearInterval(watchdog);
      throw new Error(await parseError(res));
    }
    if (!res.body) {
      clearInterval(watchdog);
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let acc = "";
    let finished = false;
    let sawTerminal = false;

    setStreaming("");

    const finish = () => {
      if (finished) return;
      finished = true;
      clearInterval(watchdog);
      if (acc.trim()) addMessage("agent", acc);
      setStreaming(null);
    };

    let failure: string | null = null;

    try {
      outer: while (true) {
        const { done, value } = await reader.read();
        lastActivity = Date.now();
        if (done) {
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
              sawTerminal = true;
              failure = ev.data?.message || "Agenten klarte ikke å fullføre denne forespørselen.";
              break outer;
            case "billing.error":
              if (ev.data?.message) addMessage("error", ev.data.message);
              break;
            case "session.waiting":
              if (ev.data?.continuationToken) continuationRef.current = ev.data.continuationToken;
              sawTerminal = true;
              break outer;
            case "turn.completed":
              // Wait for session.waiting (which follows turn.completed and carries continuationToken)
              break;
            case "session.completed":
              sawTerminal = true;
              break outer;
            default:
              break;
          }
        }
      }
    } catch (err) {
      if (!timedOut) {
        finish();
        throw err instanceof Error ? err : new Error("Tilkoblingen til agenten ble brutt.");
      }
    }

    finish();
    if (!failure) {
      if (timedOut) failure = timedOut;
      else if (!sawTerminal) failure = "Agenten avsluttet uten å fullføre svaret. Prøv igjen.";
    }
    if (failure) throw new Error(failure);
  }

  async function send() {
    const typed = input.trim();
    const att = attachment;
    if ((!typed && !att) || busy || uploading) return;

    const tool =
      att?.kind === "image" ? "analyze_image" : att?.kind === "video" ? "analyze_video" : "analyze_document";
    const kindWord =
      att?.kind === "image" ? "bilde" : att?.kind === "video" ? "video" : "dokument";
    const text = att
      ? `${typed || "Se på vedlagt fil."}\n\n[Vedlagt: ${att.storedAs} — ${kindWord}, ${humanSize(
          att.sizeBytes,
        )}. Bruk ${tool} med file "${att.storedAs}".]`
      : typed;

    setInput("");
    setAttachment(null);
    await dispatch({
      raw: text,
      display: typed || "Se på vedlagt fil.",
      attachment: att ? { name: att.originalName, kind: att.kind } : undefined,
    });
  }

  /** Én tur mot agenten. Alle feil ender i en synlig melding + «Prøv igjen». */
  async function dispatch(payload: RetryPayload) {
    if (busy) return;
    setBusy(true);
    setRetry(null);
    addMessage("user", payload.display, payload.attachment);
    try {
      const id = await sendTurn(sessionId, payload.raw);
      await streamReply(id);
    } catch (err) {
      addMessage("error", err instanceof Error ? err.message : "Noe gikk galt.");
      setRetry(payload);
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
    setAttachment(null);
    setRetry(null);
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
            {m.attachment && (
              <span className="mb-1 flex items-center gap-1.5 rounded-md bg-black/25 px-2 py-1 text-xs">
                <span aria-hidden>{KIND_ICON[m.attachment.kind]}</span>
                <span className="truncate max-w-[16rem]">{m.attachment.name}</span>
              </span>
            )}
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

      {attachment && (
        <div className="mt-3 flex items-center gap-2 self-start rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-300">
          <span aria-hidden>{KIND_ICON[attachment.kind]}</span>
          <span className="max-w-[18rem] truncate">{attachment.originalName}</span>
          <span className="text-zinc-500">{humanSize(attachment.sizeBytes)}</span>
          <button
            type="button"
            onClick={() => setAttachment(null)}
            disabled={busy}
            aria-label="Remove attachment"
            className="rounded px-1 text-zinc-400 hover:text-white disabled:opacity-50"
          >
            ×
          </button>
        </div>
      )}

      {retry && !busy && (
        <div className="mt-3 flex items-center gap-2 self-start rounded-lg border border-red-900 bg-red-950/40 px-3 py-1.5 text-xs text-red-300">
          <span>Agenten stoppet før svaret var ferdig.</span>
          <button
            type="button"
            onClick={() => void dispatch(retry)}
            className="rounded border border-red-700 px-2 py-0.5 font-medium text-red-200 hover:bg-red-900/60"
          >
            Prøv igjen
          </button>
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
        className="mt-4 flex items-end gap-2"
      >
        <input
          ref={fileRef}
          type="file"
          accept={ACCEPTED_FILES}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void uploadFile(file);
          }}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy || uploading}
          title="Attach an image or video"
          aria-label="Attach an image or video"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-zinc-700 text-xl leading-none hover:bg-zinc-900 disabled:opacity-50"
        >
          {uploading ? "…" : "+"}
        </button>
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
          disabled={busy || uploading || (!input.trim() && !attachment)}
          className="rounded-lg bg-blue-600 px-5 py-2.5 font-medium hover:bg-blue-500 disabled:opacity-50"
        >
          {busy ? "Thinking…" : "Send"}
        </button>
      </form>
    </div>
  );
}
