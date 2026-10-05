import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { cliTokens, users } from "@/lib/db/schema";

// ---------------------------------------------------------------------------
// CLI / API tokens.
//
// A token is a random 32-byte value with a recognisable prefix:
//     tai_<43 base64url chars>
// Only the SHA-256 hash is stored, so a database leak does not reveal tokens.
// The plaintext is shown exactly once, when the token is created.
// ---------------------------------------------------------------------------

export const CLI_TOKEN_PREFIX = "tai_";

export interface CliTokenSummary {
  id: string;
  name: string;
  prefix: string;
  createdAt: Date;
  lastUsedAt: Date | null;
  expiresAt: Date | null;
}

export interface CliTokenUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

function newToken(): string {
  return `${CLI_TOKEN_PREFIX}${randomBytes(32).toString("base64url")}`;
}

export function looksLikeCliToken(value: string): boolean {
  return value.startsWith(CLI_TOKEN_PREFIX) && value.length >= 20;
}

/** Create a token for a user. `token` is returned once and never stored. */
export async function createCliToken(
  userId: string,
  name = "CLI",
  options: { expiresAt?: Date | null } = {},
): Promise<{ id: string; token: string; prefix: string }> {
  const token = newToken();
  const id = randomUUID();
  const now = new Date();
  const prefix = token.slice(0, 12);

  await db.insert(cliTokens).values({
    id,
    userId,
    name: name.slice(0, 60) || "CLI",
    tokenHash: hashToken(token),
    prefix,
    expiresAt: options.expiresAt ?? null,
    createdAt: now,
  });

  return { id, token, prefix };
}

export async function listCliTokens(userId: string): Promise<CliTokenSummary[]> {
  const rows = await db
    .select({
      id: cliTokens.id,
      name: cliTokens.name,
      prefix: cliTokens.prefix,
      createdAt: cliTokens.createdAt,
      lastUsedAt: cliTokens.lastUsedAt,
      expiresAt: cliTokens.expiresAt,
    })
    .from(cliTokens)
    .where(and(eq(cliTokens.userId, userId), isNull(cliTokens.revokedAt)))
    .orderBy(desc(cliTokens.createdAt));
  return rows;
}

export async function revokeCliToken(userId: string, id: string): Promise<boolean> {
  const result = await db
    .update(cliTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(cliTokens.id, id), eq(cliTokens.userId, userId)))
    .returning({ id: cliTokens.id });
  return result.length > 0;
}

/**
 * Resolve a bearer token to a user. Returns null for unknown, revoked or
 * expired tokens. Touches `lastUsedAt` at most once per minute.
 */
export async function resolveCliToken(bearer: string): Promise<CliTokenUser | null> {
  if (!looksLikeCliToken(bearer)) return null;
  const tokenHash = hashToken(bearer);

  const [row] = await db
    .select({
      id: cliTokens.id,
      lastUsedAt: cliTokens.lastUsedAt,
      expiresAt: cliTokens.expiresAt,
      revokedAt: cliTokens.revokedAt,
      userId: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
    })
    .from(cliTokens)
    .innerJoin(users, eq(users.id, cliTokens.userId))
    .where(eq(cliTokens.tokenHash, tokenHash))
    .limit(1);

  if (!row || row.revokedAt) return null;
  if (row.expiresAt && row.expiresAt.getTime() <= Date.now()) return null;

  // Constant-time compare as defence in depth (the lookup is already a hash).
  const expected = Buffer.from(tokenHash, "hex");
  const actual = Buffer.from(hashToken(bearer), "hex");
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;

  const now = Date.now();
  if (!row.lastUsedAt || now - row.lastUsedAt.getTime() > 60_000) {
    await db
      .update(cliTokens)
      .set({ lastUsedAt: new Date(now) })
      .where(eq(cliTokens.id, row.id));
  }

  return { id: row.userId, email: row.email, name: row.name, role: row.role };
}
