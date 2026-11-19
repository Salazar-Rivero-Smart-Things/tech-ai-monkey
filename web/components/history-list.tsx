"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { ConversationSummary, HistoryMessageItem } from "@/lib/history";

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function HistoryList({
  initialConversations,
}: {
  initialConversations: ConversationSummary[];
}) {
  const [items, setItems] = useState<ConversationSummary[]>(initialConversations);
  const [query, setQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [messagesById, setMessagesById] = useState<Record<string, HistoryMessageItem[]>>({});
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.lastMessagePreview.toLowerCase().includes(q),
    );
  }, [items, query]);

  async function togglePreview(id: string) {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    if (messagesById[id]) return;

    setLoadingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/history/${encodeURIComponent(id)}`, { cache: "no-store" });
      const body = (await res.json()) as {
        ok?: boolean;
        error?: string;
        conversation?: { messages: HistoryMessageItem[] };
      };
      if (!res.ok || !body.ok || !body.conversation) {
        throw new Error(body.error || "Could not load conversation messages.");
      }
      setMessagesById((prev) => ({ ...prev, [id]: body.conversation!.messages }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load conversation.");
    } finally {
      setLoadingId(null);
    }
  }

  async function saveTitle(id: string) {
    const trimmed = editTitle.trim();
    if (!trimmed) {
      setEditingId(null);
      return;
    }
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/history/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: trimmed }),
      });
      const body = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !body.ok) throw new Error(body.error || "Failed to rename conversation.");
      setItems((prev) => prev.map((c) => (c.id === id ? { ...c, title: trimmed } : c)));
      setEditingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to rename conversation.");
    } finally {
      setBusyId(null);
    }
  }

  async function removeConversation(id: string) {
    if (!window.confirm("Delete this conversation from your history?")) return;
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/history/${encodeURIComponent(id)}`, { method: "DELETE" });
      const body = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !body.ok) throw new Error(body.error || "Failed to delete conversation.");
      setItems((prev) => prev.filter((c) => c.id !== id));
      if (expandedId === id) setExpandedId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete conversation.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">History</h1>
          <p className="text-sm text-zinc-400">
            Your recent conversations and tasks with Tech AI Monkey. Open any thread to review or
            continue where you left off.
          </p>
        </div>
        <Link
          href="/dashboard/chat"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
        >
          New chat
        </Link>
      </div>

      <div className="flex items-center gap-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search recent conversations…"
          className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3.5 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:border-zinc-600 focus:outline-none"
        />
      </div>

      {error && (
        <div className="rounded-lg border border-red-900 bg-red-950/40 px-4 py-2.5 text-sm text-red-300">
          {error}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6 text-sm text-zinc-400">
          {items.length === 0 ? (
            <>
              No saved conversations yet. Start chatting in{" "}
              <Link href="/dashboard/chat" className="text-blue-400 hover:underline">
                Chat with AI
              </Link>{" "}
              and every conversation will appear here automatically.
            </>
          ) : (
            <>No conversations match &ldquo;{query}&rdquo;.</>
          )}
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.map((conv) => {
            const isExpanded = expandedId === conv.id;
            const isEditing = editingId === conv.id;
            const isBusy = busyId === conv.id;
            const msgs = messagesById[conv.id];

            return (
              <li
                key={conv.id}
                className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 transition-colors hover:border-zinc-700"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    {isEditing ? (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          void saveTitle(conv.id);
                        }}
                        className="flex items-center gap-2"
                      >
                        <input
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          autoFocus
                          maxLength={120}
                          className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-2.5 py-1 text-sm text-white"
                        />
                        <button
                          type="submit"
                          disabled={isBusy}
                          className="rounded-md bg-blue-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-50"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="rounded-md border border-zinc-700 px-2.5 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
                        >
                          Cancel
                        </button>
                      </form>
                    ) : (
                      <Link
                        href={`/dashboard/chat?conversation=${encodeURIComponent(conv.id)}`}
                        className="block truncate font-medium text-zinc-100 hover:text-blue-400"
                      >
                        {conv.title}
                      </Link>
                    )}

                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                      <span>{formatTimestamp(conv.updatedAt)}</span>
                      <span>·</span>
                      <span>
                        {conv.messageCount} {conv.messageCount === 1 ? "message" : "messages"}
                      </span>
                    </div>

                    {conv.lastMessagePreview && (
                      <p className="mt-2 line-clamp-2 text-xs text-zinc-400">
                        {conv.lastMessageRole === "user" ? "You: " : "AI: "}
                        {conv.lastMessagePreview}
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <Link
                      href={`/dashboard/chat?conversation=${encodeURIComponent(conv.id)}`}
                      className="rounded-lg bg-zinc-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700"
                    >
                      Open
                    </Link>
                    <button
                      type="button"
                      onClick={() => void togglePreview(conv.id)}
                      className="rounded-lg border border-zinc-700 px-2.5 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800"
                    >
                      {isExpanded ? "Hide" : "Preview"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(conv.id);
                        setEditTitle(conv.title);
                      }}
                      disabled={isBusy}
                      className="rounded-lg border border-zinc-700 px-2.5 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
                    >
                      Rename
                    </button>
                    <button
                      type="button"
                      onClick={() => void removeConversation(conv.id)}
                      disabled={isBusy}
                      className="rounded-lg border border-zinc-800 px-2.5 py-1.5 text-xs text-zinc-400 hover:border-red-900 hover:bg-red-950/40 hover:text-red-300 disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="mt-4 space-y-2 border-t border-zinc-800 pt-3">
                    {loadingId === conv.id ? (
                      <p className="text-xs text-zinc-500">Loading messages…</p>
                    ) : !msgs || msgs.length === 0 ? (
                      <p className="text-xs text-zinc-500">No messages recorded in this thread.</p>
                    ) : (
                      <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
                        {msgs.map((m) => (
                          <div
                            key={m.id}
                            className={`rounded-lg px-3 py-2 text-xs whitespace-pre-wrap break-words ${
                              m.role === "user"
                                ? "bg-blue-950/60 text-blue-100 border border-blue-900/50"
                                : m.role === "error"
                                  ? "bg-red-950/50 text-red-300"
                                  : "bg-zinc-950 text-zinc-300 border border-zinc-800"
                            }`}
                          >
                            <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                              {m.role === "user" ? "You" : m.role === "error" ? "Error" : "AI"}
                            </div>
                            {m.content}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
