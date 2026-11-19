import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { chatConversations, chatMessages } from "@/lib/db/schema";
import {
  deriveConversationTitle,
  ensureHistoryTables,
  listUserConversations,
  resolveHistoryUserId,
} from "@/lib/history";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type IncomingMessage = {
  role?: string;
  content?: string;
  attachment?: { name: string; kind: "image" | "video" | "document" } | null;
};

/**
 * GET /api/history?q=&limit=30
 * Lists the authenticated user's recent conversations.
 */
export async function GET(request: Request) {
  const userId = await resolveHistoryUserId(request);
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Not authenticated." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") ?? undefined;
  const rawLimit = Number(searchParams.get("limit") ?? "50");
  const limit = Number.isFinite(rawLimit) ? rawLimit : 50;

  try {
    const conversations = await listUserConversations(userId, { query, limit });
    return NextResponse.json({ ok: true, conversations });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to load history." },
      { status: 500 },
    );
  }
}

/**
 * POST /api/history
 * Creates a conversation (if conversationId is omitted) and/or appends messages
 * and updates session metadata (eveSessionId, continuationToken, eventCount).
 */
export async function POST(request: Request) {
  const userId = await resolveHistoryUserId(request);
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Not authenticated." }, { status: 401 });
  }

  let body: {
    conversationId?: string | null;
    eveSessionId?: string | null;
    title?: string | null;
    continuationToken?: string | null;
    eventCount?: number | null;
    messages?: IncomingMessage[];
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const incomingMessages = Array.isArray(body.messages)
    ? body.messages.filter(
        (m): m is { role: "user" | "agent" | "error"; content: string; attachment?: IncomingMessage["attachment"] } =>
          typeof m?.content === "string" &&
          m.content.trim().length > 0 &&
          (m.role === "user" || m.role === "agent" || m.role === "error"),
      )
    : [];

  const now = new Date();
  let conversationId = typeof body.conversationId === "string" ? body.conversationId.trim() : "";

  try {
    await ensureHistoryTables();
    if (conversationId) {
      const [existing] = await db
        .select()
        .from(chatConversations)
        .where(
          and(
            eq(chatConversations.id, conversationId),
            eq(chatConversations.userId, userId),
          ),
        )
        .limit(1);

      if (!existing) {
        return NextResponse.json({ ok: false, error: "Conversation not found." }, { status: 404 });
      }

      const updates: Partial<typeof chatConversations.$inferInsert> = {
        updatedAt: now,
      };
      if (typeof body.eveSessionId === "string" && body.eveSessionId.trim()) {
        updates.eveSessionId = body.eveSessionId.trim();
      }
      if (typeof body.continuationToken === "string") {
        updates.continuationToken = body.continuationToken;
      }
      if (typeof body.eventCount === "number" && Number.isFinite(body.eventCount)) {
        updates.eventCount = Math.max(0, Math.floor(body.eventCount));
      }
      if (typeof body.title === "string" && body.title.trim()) {
        updates.title = body.title.trim().slice(0, 120);
      }

      await db
        .update(chatConversations)
        .set(updates)
        .where(
          and(
            eq(chatConversations.id, conversationId),
            eq(chatConversations.userId, userId),
          ),
        );
    } else {
      conversationId = crypto.randomUUID();
      const firstUserText =
        body.title?.trim() ||
        incomingMessages.find((m) => m.role === "user")?.content ||
        incomingMessages[0]?.content ||
        "New conversation";

      await db.insert(chatConversations).values({
        id: conversationId,
        userId,
        eveSessionId: body.eveSessionId?.trim() || null,
        title: deriveConversationTitle(firstUserText),
        continuationToken: body.continuationToken ?? null,
        eventCount:
          typeof body.eventCount === "number" && Number.isFinite(body.eventCount)
            ? Math.max(0, Math.floor(body.eventCount))
            : 0,
        createdAt: now,
        updatedAt: now,
      });
    }

    if (incomingMessages.length > 0) {
      await db.insert(chatMessages).values(
        incomingMessages.map((m, idx) => ({
          id: crypto.randomUUID(),
          conversationId,
          userId,
          role: m.role,
          content: m.content,
          attachment: m.attachment ?? null,
          createdAt: new Date(now.getTime() + idx),
        })),
      );
    }

    const [saved] = await db
      .select()
      .from(chatConversations)
      .where(eq(chatConversations.id, conversationId))
      .limit(1);

    return NextResponse.json({
      ok: true,
      conversation: saved
        ? {
            id: saved.id,
            title: saved.title,
            eveSessionId: saved.eveSessionId,
            continuationToken: saved.continuationToken,
            eventCount: saved.eventCount,
            createdAt: saved.createdAt.toISOString(),
            updatedAt: saved.updatedAt.toISOString(),
          }
        : { id: conversationId },
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to save history." },
      { status: 500 },
    );
  }
}
