import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { chatConversations } from "@/lib/db/schema";
import {
  ensureHistoryTables,
  getUserConversationDetail,
  resolveHistoryUserId,
} from "@/lib/history";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  const userId = await resolveHistoryUserId(request);
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Not authenticated." }, { status: 401 });
  }

  const { id } = await context.params;
  const detail = await getUserConversationDetail(userId, id);
  if (!detail) {
    return NextResponse.json({ ok: false, error: "Conversation not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true, conversation: detail });
}

export async function PATCH(request: Request, context: RouteContext) {
  const userId = await resolveHistoryUserId(request);
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Not authenticated." }, { status: 401 });
  }

  const { id } = await context.params;
  let body: {
    title?: string;
    eveSessionId?: string | null;
    continuationToken?: string | null;
    eventCount?: number;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const updates: Partial<typeof chatConversations.$inferInsert> = {
    updatedAt: new Date(),
  };
  if (typeof body.title === "string" && body.title.trim()) {
    updates.title = body.title.trim().slice(0, 120);
  }
  if (typeof body.eveSessionId === "string" || body.eveSessionId === null) {
    updates.eveSessionId = body.eveSessionId;
  }
  if (typeof body.continuationToken === "string" || body.continuationToken === null) {
    updates.continuationToken = body.continuationToken;
  }
  if (typeof body.eventCount === "number" && Number.isFinite(body.eventCount)) {
    updates.eventCount = Math.max(0, Math.floor(body.eventCount));
  }

  await ensureHistoryTables();
  const updated = await db
    .update(chatConversations)
    .set(updates)
    .where(and(eq(chatConversations.id, id), eq(chatConversations.userId, userId)))
    .returning();

  if (updated.length === 0) {
    return NextResponse.json({ ok: false, error: "Conversation not found." }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    conversation: {
      id: updated[0].id,
      title: updated[0].title,
      updatedAt: updated[0].updatedAt.toISOString(),
    },
  });
}

export async function DELETE(request: Request, context: RouteContext) {
  const userId = await resolveHistoryUserId(request);
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Not authenticated." }, { status: 401 });
  }

  const { id } = await context.params;
  await ensureHistoryTables();
  const deleted = await db
    .delete(chatConversations)
    .where(and(eq(chatConversations.id, id), eq(chatConversations.userId, userId)))
    .returning({ id: chatConversations.id });

  if (deleted.length === 0) {
    return NextResponse.json({ ok: false, error: "Conversation not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true, id });
}
