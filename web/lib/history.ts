import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { chatConversations, chatMessages, users } from "@/lib/db/schema";
import { bearerFrom, resolveApiCaller } from "@/lib/api-caller";
import { verifyAgentToken } from "@/lib/agent-auth";

const globalForHistory = globalThis as unknown as {
  __historyTablesReady?: Promise<void>;
};

/**
 * Idempotently ensures the chatConversation & chatMessage tables exist so
 * History works immediately on both localhost and tech-ai.tech even before
 * `drizzle-kit push` is manually executed.
 */
export function ensureHistoryTables(): Promise<void> {
  if (!globalForHistory.__historyTablesReady) {
    globalForHistory.__historyTablesReady = (async () => {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "chatConversation" (
          "id" text PRIMARY KEY NOT NULL,
          "userId" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
          "eveSessionId" text,
          "title" text DEFAULT 'New conversation' NOT NULL,
          "continuationToken" text,
          "eventCount" integer DEFAULT 0 NOT NULL,
          "createdAt" timestamp DEFAULT now() NOT NULL,
          "updatedAt" timestamp DEFAULT now() NOT NULL
        );
      `);
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS "chatConversation_userId_idx"
        ON "chatConversation" ("userId");
      `);
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS "chatConversation_userId_updatedAt_idx"
        ON "chatConversation" ("userId", "updatedAt");
      `);
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS "chatConversation_eveSessionId_idx"
        ON "chatConversation" ("eveSessionId");
      `);
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "chatMessage" (
          "id" text PRIMARY KEY NOT NULL,
          "conversationId" text NOT NULL REFERENCES "chatConversation"("id") ON DELETE CASCADE,
          "userId" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
          "role" text NOT NULL,
          "content" text NOT NULL,
          "attachment" jsonb,
          "createdAt" timestamp DEFAULT now() NOT NULL
        );
      `);
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS "chatMessage_conversationId_idx"
        ON "chatMessage" ("conversationId");
      `);
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS "chatMessage_userId_idx"
        ON "chatMessage" ("userId");
      `);
    })().catch((err) => {
      globalForHistory.__historyTablesReady = undefined;
      throw err;
    });
  }
  return globalForHistory.__historyTablesReady;
}

export interface ConversationSummary {
  id: string;
  title: string;
  eveSessionId: string | null;
  messageCount: number;
  lastMessageRole: string | null;
  lastMessagePreview: string;
  createdAt: string;
  updatedAt: string;
}

export interface HistoryMessageItem {
  id: string;
  role: "user" | "agent" | "error";
  content: string;
  attachment: { name: string; kind: "image" | "video" | "document" } | null;
  createdAt: string;
}

export interface ConversationDetail {
  id: string;
  title: string;
  eveSessionId: string | null;
  continuationToken: string | null;
  eventCount: number;
  createdAt: string;
  updatedAt: string;
  messages: HistoryMessageItem[];
}

/**
 * Resolve who is calling `/api/history`:
 *   1. Browser NextAuth session or CLI bearer token (`resolveApiCaller`)
 *   2. Short-lived internal agent JWT minted by the `get_chat_history` tool
 */
export async function resolveHistoryUserId(request: Request): Promise<string | null> {
  const caller = await resolveApiCaller(request);
  if (caller?.userId) return caller.userId;

  const bearer = bearerFrom(request);
  if (bearer) {
    const agent = await verifyAgentToken(bearer);
    if (agent?.userId) {
      const existing = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, agent.userId))
        .limit(1);
      if (existing.length > 0) return existing[0].id;

      // Local-dev fallback when the eve session principal isn't a DB UUID
      const fallback = await db.select({ id: users.id }).from(users).limit(1);
      if (fallback.length > 0) return fallback[0].id;
    }
  }

  return null;
}

export function deriveConversationTitle(text: string): string {
  const cleaned = text
    .replace(/\s+/g, " ")
    .replace(/^["'`]+|["'`]+$/g, "")
    .trim();
  if (!cleaned) return "New conversation";
  return cleaned.length > 72 ? `${cleaned.slice(0, 71).trimEnd()}…` : cleaned;
}

export async function listUserConversations(
  userId: string,
  options: { query?: string; limit?: number } = {},
): Promise<ConversationSummary[]> {
  await ensureHistoryTables();
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 100);
  const query = (options.query ?? "").trim().toLowerCase();

  const rows = await db
    .select()
    .from(chatConversations)
    .where(eq(chatConversations.userId, userId))
    .orderBy(desc(chatConversations.updatedAt))
    .limit(query ? 200 : limit);

  if (rows.length === 0) return [];

  const convIds = rows.map((r) => r.id);
  const msgs = await db
    .select()
    .from(chatMessages)
    .where(
      and(
        eq(chatMessages.userId, userId),
        inArray(chatMessages.conversationId, convIds),
      ),
    )
    .orderBy(asc(chatMessages.createdAt));

  const byConv = new Map<string, typeof msgs>();
  for (const m of msgs) {
    const list = byConv.get(m.conversationId) ?? [];
    list.push(m);
    byConv.set(m.conversationId, list);
  }

  const summaries: ConversationSummary[] = [];
  for (const c of rows) {
    const list = byConv.get(c.id) ?? [];
    if (query) {
      const inTitle = c.title.toLowerCase().includes(query);
      const inMsgs = list.some((m) => m.content.toLowerCase().includes(query));
      if (!inTitle && !inMsgs) continue;
    }

    const last = list.at(-1) ?? null;
    const rawPreview = (last?.content ?? "").replace(/\s+/g, " ").trim();
    const preview =
      rawPreview.length > 160 ? `${rawPreview.slice(0, 159).trimEnd()}…` : rawPreview;

    summaries.push({
      id: c.id,
      title: c.title,
      eveSessionId: c.eveSessionId ?? null,
      messageCount: list.length,
      lastMessageRole: last?.role ?? null,
      lastMessagePreview: preview,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    });

    if (summaries.length >= limit) break;
  }

  return summaries;
}

export async function getUserConversationDetail(
  userId: string,
  conversationId: string,
): Promise<ConversationDetail | null> {
  await ensureHistoryTables();
  const [conv] = await db
    .select()
    .from(chatConversations)
    .where(
      and(
        eq(chatConversations.id, conversationId),
        eq(chatConversations.userId, userId),
      ),
    )
    .limit(1);

  if (!conv) return null;

  const msgs = await db
    .select()
    .from(chatMessages)
    .where(
      and(
        eq(chatMessages.conversationId, conv.id),
        eq(chatMessages.userId, userId),
      ),
    )
    .orderBy(asc(chatMessages.createdAt));

  return {
    id: conv.id,
    title: conv.title,
    eveSessionId: conv.eveSessionId ?? null,
    continuationToken: conv.continuationToken ?? null,
    eventCount: conv.eventCount ?? 0,
    createdAt: conv.createdAt.toISOString(),
    updatedAt: conv.updatedAt.toISOString(),
    messages: msgs.map((m) => ({
      id: m.id,
      role: (m.role === "user" || m.role === "agent" || m.role === "error"
        ? m.role
        : "agent") as "user" | "agent" | "error",
      content: m.content,
      attachment: m.attachment ?? null,
      createdAt: m.createdAt.toISOString(),
    })),
  };
}
