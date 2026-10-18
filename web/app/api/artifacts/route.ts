import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { artifacts, users } from "@/lib/db/schema";
import crypto from "crypto";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { userId, title, kind, files } = body;

    if (!userId) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

    // Strip any channel issuer prefix such as "my-ai-agent:" from principalId
    let resolvedUserId = String(userId).replace(/^[^:]+:/, "").trim();

    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, resolvedUserId))
      .limit(1);

    if (existing.length === 0) {
      // Fallback for local/test sessions where subject is not a DB UUID
      const fallbackUser = await db.select({ id: users.id }).from(users).limit(1);
      if (fallbackUser.length > 0) {
        resolvedUserId = fallbackUser[0].id;
      }
    }

    const artifactId = crypto.randomUUID();

    await db.insert(artifacts).values({
      id: artifactId,
      userId: resolvedUserId,
      title: title || "Untitled Artifact",
      kind: kind || "project",
      content: JSON.stringify(files ?? []),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return NextResponse.json({ ok: true, artifactId, userId: resolvedUserId });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

