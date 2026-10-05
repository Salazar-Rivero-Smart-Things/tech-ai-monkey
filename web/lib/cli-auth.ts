import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { cliAuthCodes } from "@/lib/db/schema";

// ---------------------------------------------------------------------------
// CLI login (PKCE, RFC 7636).
//
// Flow:
//   1. The CLI generates a random `code_verifier`, derives
//      `code_challenge = BASE64URL(SHA256(verifier))` and starts a loopback
//      HTTP server on 127.0.0.1:<port>.
//   2. It opens https://<app>/cli-login?port=<port>&state=<state>&challenge=<challenge>
//   3. The user signs in there (Google or e-mail + password) and approves.
//   4. /cli-login creates a one-time code and redirects the browser to
//      http://127.0.0.1:<port>/callback?code=<code>&state=<state>
//   5. The CLI POSTs { code, code_verifier } to /api/cli/token and receives a
//      long-lived cliToken.
//
// Only the SHA-256 of the code and of the token are stored.
// ---------------------------------------------------------------------------

const CODE_TTL_MS = 5 * 60 * 1000;

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

/** BASE64URL(SHA256(ascii(code_verifier))) — the S256 transformation. */
export function pkceChallengeFor(verifier: string): string {
  return createHash("sha256").update(verifier, "utf8").digest("base64url");
}

export function isValidPkceChallenge(challenge: string): boolean {
  return /^[A-Za-z0-9_-]{43,128}$/.test(challenge);
}

export function isValidVerifier(verifier: string): boolean {
  return /^[A-Za-z0-9\-._~]{43,128}$/.test(verifier);
}

/** Only allow loopback callbacks on unprivileged ports. */
export function isValidRedirectPort(port: number): boolean {
  return Number.isInteger(port) && port >= 1024 && port <= 65535;
}

export function isValidState(state: string): boolean {
  return /^[A-Za-z0-9_-]{8,128}$/.test(state);
}

export async function createAuthCode(input: {
  userId: string;
  codeChallenge: string;
  redirectPort: number;
  clientName?: string | null;
}): Promise<string> {
  const code = randomBytes(32).toString("base64url");
  const now = new Date();
  await db.insert(cliAuthCodes).values({
    codeHash: sha256Hex(code),
    userId: input.userId,
    codeChallenge: input.codeChallenge,
    redirectPort: input.redirectPort,
    clientName: input.clientName?.slice(0, 60) ?? null,
    expiresAt: new Date(now.getTime() + CODE_TTL_MS),
    createdAt: now,
  });
  return code;
}

/** Verify PKCE and burn the code. Returns the userId it was issued to. */
export async function consumeAuthCode(input: {
  code: string;
  codeVerifier: string;
}): Promise<{ userId: string; redirectPort: number } | null> {
  if (!isValidVerifier(input.codeVerifier)) return null;

  const codeHash = sha256Hex(input.code);
  const [row] = await db
    .select()
    .from(cliAuthCodes)
    .where(eq(cliAuthCodes.codeHash, codeHash))
    .limit(1);

  if (!row) return null;
  if (row.usedAt) return null;
  if (row.expiresAt.getTime() <= Date.now()) return null;

  const expected = Buffer.from(row.codeChallenge, "utf8");
  const actual = Buffer.from(pkceChallengeFor(input.codeVerifier), "utf8");
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;

  await db
    .update(cliAuthCodes)
    .set({ usedAt: new Date() })
    .where(eq(cliAuthCodes.codeHash, codeHash));

  return { userId: row.userId, redirectPort: row.redirectPort };
}
