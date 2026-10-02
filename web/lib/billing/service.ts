import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  subscriptions,
  tokenBalances,
  tokenTransactions,
  type PlanId,
} from "@/lib/db/schema";
import { PLANS, FREE_REFILL_WAIT_DAYS } from "./plans";

export interface BillingState {
  plan: PlanId;
  status: string;
  tokenAllowance: number;
  tokensUsed: number;
  prepaidTokens: number;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  freeRefillAt: Date | null;
  subscriptionRemaining: number;
  totalRemaining: number;
}

async function getSubscription(userId: string) {
  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .limit(1);
  return sub;
}

async function getBalance(userId: string) {
  const [bal] = await db
    .select()
    .from(tokenBalances)
    .where(eq(tokenBalances.userId, userId))
    .limit(1);
  return bal;
}

// OAuth users never go through the signup route, so create their billing rows
// lazily (free plan + zero prepaid balance).
export async function ensureBillingRows(userId: string) {
  const sub = await getSubscription(userId);
  const now = new Date();
  if (!sub) {
    const free = PLANS.free;
    await db.insert(subscriptions).values({
      id: randomUUID(),
      userId,
      plan: "free",
      status: "active",
      tokenAllowance: free.tokens,
      tokensUsed: 0,
      currentPeriodStart: now,
      currentPeriodEnd: new Date(now.getTime() + free.periodDays * 86_400_000),
      cancelAtPeriodEnd: false,
      createdAt: now,
      updatedAt: now,
    });
  } else if (sub.plan === "free" && sub.tokenAllowance < PLANS.free.tokens) {
    // One-time upgrade: legacy free plans (e.g. the old 40k allowance) get the
    // current 80k allowance, a fresh usage counter, and a fresh 5-day period.
    await db
      .update(subscriptions)
      .set({
        tokenAllowance: PLANS.free.tokens,
        tokensUsed: 0,
        currentPeriodStart: now,
        currentPeriodEnd: new Date(now.getTime() + PLANS.free.periodDays * 86_400_000),
        updatedAt: now,
      })
      .where(eq(subscriptions.userId, userId));
  }
  const bal = await getBalance(userId);
  if (!bal) {
    await db.insert(tokenBalances).values({ userId, prepaidTokens: 0, updatedAt: now });
  }
}

// Refill the free plan: 40k tokens every 5 days, but if the user burned through
// early they wait FREE_REFILL_WAIT_DAYS from exhaustion before the next refill.
async function maybeRefillFree(userId: string, sub: NonNullable<Awaited<ReturnType<typeof getSubscription>>>) {
  if (sub.plan !== "free") return;
  const now = Date.now();
  const refillDue = sub.freeRefillAt
    ? now >= sub.freeRefillAt.getTime()
    : now >= sub.currentPeriodEnd.getTime();
  if (!refillDue) return;

  const free = PLANS.free;
  await db
    .update(subscriptions)
    .set({
      tokenAllowance: free.tokens,
      tokensUsed: 0,
      currentPeriodStart: new Date(now),
      currentPeriodEnd: new Date(now + free.periodDays * 86_400_000),
      freeRefillAt: null,
      updatedAt: new Date(now),
    })
    .where(eq(subscriptions.userId, userId));
}

export async function getBillingState(userId: string): Promise<BillingState> {
  await ensureBillingRows(userId);
  const sub = (await getSubscription(userId))!;
  await maybeRefillFree(userId, sub);
  const fresh = (await getSubscription(userId))!;
  const bal = await getBalance(userId);
  const prepaidTokens = bal?.prepaidTokens ?? 0;
  const subscriptionRemaining = Math.max(0, fresh.tokenAllowance - fresh.tokensUsed);

  return {
    plan: fresh.plan,
    status: fresh.status,
    tokenAllowance: fresh.tokenAllowance,
    tokensUsed: fresh.tokensUsed,
    prepaidTokens,
    currentPeriodStart: fresh.currentPeriodStart,
    currentPeriodEnd: fresh.currentPeriodEnd,
    freeRefillAt: fresh.freeRefillAt,
    subscriptionRemaining,
    totalRemaining: subscriptionRemaining + prepaidTokens,
  };
}

// Activate (or renew) a plan with a fresh period. Used by checkout/webhooks.
export async function activatePlan(userId: string, planId: PlanId) {
  const plan = PLANS[planId];
  const now = new Date();
  await db.transaction(async (tx) => {
    await tx
      .update(subscriptions)
      .set({
        plan: planId,
        status: "active",
        tokenAllowance: plan.tokens,
        tokensUsed: 0,
        currentPeriodStart: now,
        currentPeriodEnd: new Date(now.getTime() + plan.periodDays * 86_400_000),
        cancelAtPeriodEnd: false,
        freeRefillAt: null,
        updatedAt: now,
      })
      .where(eq(subscriptions.userId, userId));

    await tx.insert(tokenTransactions).values({
      id: randomUUID(),
      userId,
      kind: "subscription_grant",
      tokens: plan.tokens,
      balanceAfter: plan.tokens,
      metadata: { plan: planId },
      createdAt: now,
    });
  });
}

// Add prepaid pay-as-you-go tokens.
export async function grantPrepaidTokens(
  userId: string,
  tokens: number,
  metadata: Record<string, unknown> = {},
) {
  await db.transaction(async (tx) => {
    const [bal] = await tx
      .select()
      .from(tokenBalances)
      .where(eq(tokenBalances.userId, userId))
      .limit(1);
    const next = (bal?.prepaidTokens ?? 0) + tokens;
    await tx
      .insert(tokenBalances)
      .values({ userId, prepaidTokens: next, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: tokenBalances.userId,
        set: { prepaidTokens: next, updatedAt: new Date() },
      });
    await tx.insert(tokenTransactions).values({
      id: randomUUID(),
      userId,
      kind: "topup",
      tokens,
      balanceAfter: next,
      metadata,
      createdAt: new Date(),
    });
  });
}

// Consume tokens: prepaid balance first, then the subscription allowance.
export async function consumeTokens(
  userId: string,
  amount: number,
  metadata: Record<string, unknown> = {},
) {
  await ensureBillingRows(userId);
  await db.transaction(async (tx) => {
    const [sub] = await tx
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId))
      .limit(1);
    const [bal] = await tx
      .select()
      .from(tokenBalances)
      .where(eq(tokenBalances.userId, userId))
      .limit(1);
    if (!sub) throw new Error("No subscription row.");

    let remaining = amount;
    let prepaid = bal?.prepaidTokens ?? 0;

    // 1) spend prepaid first
    const fromPrepaid = Math.min(prepaid, remaining);
    prepaid -= fromPrepaid;
    remaining -= fromPrepaid;

    // 2) spend subscription allowance
    let used = sub.tokensUsed;
    const allowanceLeft = Math.max(0, sub.tokenAllowance - used);
    const fromAllowance = Math.min(allowanceLeft, remaining);
    used += fromAllowance;
    remaining -= fromAllowance;

    if (remaining > 0) {
      throw new Error(`Insufficient tokens (short by ${remaining}).`);
    }

    const now = new Date();
    if (fromPrepaid > 0) {
      await tx
        .update(tokenBalances)
        .set({ prepaidTokens: prepaid, updatedAt: now })
        .where(eq(tokenBalances.userId, userId));
    }
    await tx
      .update(subscriptions)
      .set({
        tokensUsed: used,
        // Free users who fully exhaust their allowance wait 7 days for a refill.
        freeRefillAt:
          sub.plan === "free" && used >= sub.tokenAllowance
            ? new Date(now.getTime() + FREE_REFILL_WAIT_DAYS * 86_400_000)
            : sub.freeRefillAt,
        updatedAt: now,
      })
      .where(eq(subscriptions.userId, userId));

    await tx.insert(tokenTransactions).values({
      id: randomUUID(),
      userId,
      kind: "usage",
      tokens: -amount,
      balanceAfter: prepaid + Math.max(0, sub.tokenAllowance - used),
      metadata,
      createdAt: now,
    });
  });
}
