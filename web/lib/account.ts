import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  accounts,
  artifacts,
  auditLogs,
  integrations,
  notebooks,
  sessions,
  subscriptions,
  tokenBalances,
  tokenTransactions,
  users,
} from "@/lib/db/schema";

// ---------------------------------------------------------------------------
// GDPR / CASA: right of access (export) and right to erasure (delete).
// The delete helper is the single source of truth used by the dashboard
// privacy page so we never forget a table when a user asks to be forgotten.
// ---------------------------------------------------------------------------

/** Every table that stores per-user rows, children first. */
const USER_TABLES = [
  integrations,
  tokenTransactions,
  tokenBalances,
  subscriptions,
  auditLogs,
  artifacts,
  notebooks,
  sessions,
  accounts,
] as const;

/** Permanently deletes everything we store for a user (irreversible). */
export async function deleteUserData(userId: string): Promise<void> {
  await db.transaction(async (tx) => {
    for (const table of USER_TABLES) {
      await tx.delete(table).where(eq(table.userId, userId));
    }
    await tx.delete(users).where(eq(users.id, userId));
  });
}

/** Portable copy of the user's data (never includes the password hash or raw tokens). */
export async function exportUserData(userId: string) {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return null;

  const [subscription] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId));
  const [balance] = await db
    .select()
    .from(tokenBalances)
    .where(eq(tokenBalances.userId, userId));

  const transactions = await db
    .select()
    .from(tokenTransactions)
    .where(eq(tokenTransactions.userId, userId));
  const notes = await db.select().from(notebooks).where(eq(notebooks.userId, userId));
  const files = await db.select().from(artifacts).where(eq(artifacts.userId, userId));
  const apps = await db.select().from(integrations).where(eq(integrations.userId, userId));
  const audit = await db.select().from(auditLogs).where(eq(auditLogs.userId, userId));

  const { passwordHash: _omit, ...profile } = user;

  return {
    exportedAt: new Date().toISOString(),
    profile,
    subscription: subscription ?? null,
    tokenBalance: balance ?? null,
    tokenTransactions: transactions,
    notebooks: notes,
    artifacts: files,
    // Tokens/secrets are stripped: only the connection metadata is exported.
    integrations: apps.map((i) => ({
      provider: i.provider,
      status: i.status,
      permission: i.permission,
      metadata: i.metadata,
    })),
    auditLog: audit,
  };
}
