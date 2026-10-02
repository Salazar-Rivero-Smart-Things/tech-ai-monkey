import type { PlanId } from "../db/schema";

export interface Plan {
  id: PlanId;
  name: string;
  priceEur: number;
  tokens: number;
  periodDays: number;
  kind: "free" | "paid";
}

// Tech AI monkey pricing (30-day subscriptions, except the 5-day free cycle).
export const PLANS: Record<PlanId, Plan> = {
  free: { id: "free", name: "Free", priceEur: 0, tokens: 80_000, periodDays: 5, kind: "free" },
  pro: { id: "pro", name: "PRO", priceEur: 40, tokens: 250_000, periodDays: 30, kind: "paid" },
  ultra: { id: "ultra", name: "Ultra", priceEur: 75, tokens: 800_000, periodDays: 30, kind: "paid" },
  bomb: { id: "bomb", name: "Bomb", priceEur: 105, tokens: 1_200_000, periodDays: 30, kind: "paid" },
};

export const PAID_PLANS: PlanId[] = ["pro", "ultra", "bomb"];

// Free plan: once exhausted, the next free 80k refill arrives after 7 days
// (users can top up with pay-as-you-go at any time instead of waiting).
export const FREE_REFILL_WAIT_DAYS = 7;

// Pay-as-you-go: prepaid, €5–€100, at €0.00016 per token.
export const PAYG_PRICE_PER_TOKEN = 0.00016;
export const PAYG_MIN_EUR = 5;
export const PAYG_MAX_EUR = 100;
export const PAYG_TOKENS_PER_5_EUR = 31_250;

export function paygTokensForEur(eur: number): number {
  return Math.floor(eur / PAYG_PRICE_PER_TOKEN);
}

export function isValidPaygAmount(eur: number): boolean {
  return eur >= PAYG_MIN_EUR && eur <= PAYG_MAX_EUR;
}
