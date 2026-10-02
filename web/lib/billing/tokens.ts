import type { PlanId } from "../db/schema";
import { FREE_REFILL_WAIT_DAYS, PLANS } from "./plans";

export interface TokenState {
  plan: PlanId;
  allowance: number;
  used: number;
  prepaid: number;
  currentPeriodEnd: Date;
  freeRefillAt: Date | null;
}

// Tokens left in the current subscription allowance.
export function subscriptionTokensRemaining(state: TokenState): number {
  return Math.max(0, state.allowance - state.used);
}

// Total tokens available: subscription allowance + prepaid pay-as-you-go.
export function totalTokensRemaining(state: TokenState): number {
  return subscriptionTokensRemaining(state) + Math.max(0, state.prepaid);
}

export function isExhausted(state: TokenState): boolean {
  return totalTokensRemaining(state) <= 0;
}

// When a free user exhausts their allowance, the next free refill arrives
// FREE_REFILL_WAIT_DAYS later (unless they buy pay-as-you-go credits).
export function freePlanNextRefillAt(exhaustedAt: Date): Date {
  return new Date(exhaustedAt.getTime() + FREE_REFILL_WAIT_DAYS * 24 * 60 * 60 * 1000);
}

// Paid plans run on 30-day periods; the allowance refills when the period
// renews. This returns the remaining period length in whole days (floor).
export function daysLeftInPeriod(state: TokenState): number {
  return Math.max(0, Math.ceil((state.currentPeriodEnd.getTime() - Date.now()) / 86_400_000));
}

export function planOf(plan: PlanId) {
  return PLANS[plan];
}
