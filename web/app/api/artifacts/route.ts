import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { artifacts } from "@/lib/db/schema";
import crypto from "crypto";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { userId, title, kind, files } = body;
    
    if (!userId) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

    const artifactId = crypto.randomUUID();
    
    await db.insert(artifacts).values({
      id: artifactId,
      userId,
      title: title || "Untitled Artifact",
      kind: kind || "project",
      content: JSON.stringify(files),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return NextResponse.json({ ok: true, artifactId });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
