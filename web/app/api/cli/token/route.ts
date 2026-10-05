import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { consumeAuthCode } from "@/lib/cli-auth";
import { createCliToken } from "@/lib/cli-tokens";
import { isUnlimited } from "@/lib/entitlements";
import { verifyPassword } from "@/lib/security/password";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// POST /api/cli/token — exchange credentials for a CLI token.
//
//   { "grant_type": "authorization_code", "code": "...", "code_verifier": "..." }
//   { "grant_type": "password", "email": "...", "password": "..." }
//
// Responds with { ok, token, user: { email, name, role, unlimited } }.
// ---------------------------------------------------------------------------

const ATTEMPT_WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 10;
const attempts = new Map<string, number[]>();

function rateLimited(key: string): boolean {
  const now = Date.now();
  const recent = (attempts.get(key) ?? []).filter((t) => now - t < ATTEMPT_WINDOW_MS);
  if (recent.length >= MAX_ATTEMPTS) {
    attempts.set(key, recent);
    return true;
  }
  recent.push(now);
  attempts.set(key, recent);
  // Keep the map from growing without bound.
  if (attempts.size > 5_000) {
    for (const [k, v] of attempts) {
      if (v.every((t) => now - t > ATTEMPT_WINDOW_MS)) attempts.delete(k);
    }
  }
  return false;
}

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return errorResponse("Invalid JSON body.");
  }

  const grantType = typeof body.grant_type === "string" ? body.grant_type : "";
  const name = typeof body.name === "string" ? body.name : "CLI";

  // --- 1. Authorization code + PKCE (browser login) -------------------------
  if (grantType === "authorization_code") {
    const code = typeof body.code === "string" ? body.code : "";
    const codeVerifier = typeof body.code_verifier === "string" ? body.code_verifier : "";
    if (!code || !codeVerifier) return errorResponse("Missing code or code_verifier.");

    const result = await consumeAuthCode({ code, codeVerifier });
    if (!result) return errorResponse("Invalid or expired login code.", 401);

    const [user] = await db
      .select({ id: users.id, email: users.email, name: users.name, role: users.role })
      .from(users)
      .where(eq(users.id, result.userId))
      .limit(1);
    if (!user) return errorResponse("Account no longer exists.", 401);

    const { token } = await createCliToken(user.id, name);
    return NextResponse.json({
      ok: true,
      token,
      user: {
        email: user.email,
        name: user.name,
        role: user.role,
        unlimited: isUnlimited(user),
      },
    });
  }

  // --- 2. E-mail + password ------------------------------------------------
  if (grantType === "password") {
    const email =
      typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (!email || !password) return errorResponse("Missing email or password.");

    const rateKey = `${email}|${request.headers.get("x-forwarded-for") ?? "local"}`;
    if (rateLimited(rateKey)) {
      return errorResponse("Too many attempts. Try again in a few minutes.", 429);
    }

    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        passwordHash: users.passwordHash,
      })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    // Always run a verification (even on unknown users) to avoid user probing.
    const hash = user?.passwordHash ?? "$argon2id$v=19$m=65536,t=3,p=4$invalid$invalid";
    const valid = await verifyPassword(hash, password).catch(() => false);
    if (!user?.passwordHash || !valid) {
      return errorResponse("Wrong e-mail or password.", 401);
    }

    const { token } = await createCliToken(user.id, name);
    return NextResponse.json({
      ok: true,
      token,
      user: {
        email: user.email,
        name: user.name,
        role: user.role,
        unlimited: isUnlimited(user),
      },
    });
  }

  return errorResponse("Unsupported grant_type. Use \"authorization_code\" or \"password\".");
}
