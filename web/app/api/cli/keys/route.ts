import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createCliToken, listCliTokens, revokeCliToken } from "@/lib/cli-tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// API keys for the CLI / your own server.
//
//   GET    /api/cli/keys       list keys (never the secret)
//   POST   /api/cli/keys       { name } -> { id, token }  (token shown once)
//   DELETE /api/cli/keys?id=   revoke a key
//
// Requires a signed-in browser session — a key can never mint another key.
// ---------------------------------------------------------------------------

async function requireUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ ok: false, error: "Not authenticated." }, { status: 401 });

  const keys = await listCliTokens(userId);
  return NextResponse.json({ ok: true, keys });
}

export async function POST(request: Request) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ ok: false, error: "Not authenticated." }, { status: 401 });

  let name = "CLI";
  try {
    const body = (await request.json()) as { name?: unknown };
    if (typeof body.name === "string" && body.name.trim()) name = body.name.trim();
  } catch {
    // An empty body is fine — fall back to the default name.
  }

  const { id, token, prefix } = await createCliToken(userId, name);
  return NextResponse.json({
    ok: true,
    key: { id, prefix, name },
    // Shown exactly once. It is never stored in plaintext.
    token,
  });
}

export async function DELETE(request: Request) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ ok: false, error: "Not authenticated." }, { status: 401 });

  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!id) return NextResponse.json({ ok: false, error: "Missing id." }, { status: 400 });

  const revoked = await revokeCliToken(userId, id);
  if (!revoked) return NextResponse.json({ ok: false, error: "Key not found." }, { status: 404 });

  return NextResponse.json({ ok: true });
}
