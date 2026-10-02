import { NextResponse } from "next/server";
import { headers } from "next/headers";
import type Stripe from "stripe";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { subscriptions, type PlanId } from "@/lib/db/schema";
import { getStripe, planIdFromPriceId, priceIdForPlan } from "@/lib/billing/stripe";
import { activatePlan, grantPrepaidTokens } from "@/lib/billing/service";
import { paygTokensForEur } from "@/lib/billing/plans";

function priceIdOf(price: string | Stripe.Price | null | undefined): string | null {
  if (!price) return null;
  return typeof price === "string" ? price : price.id;
}

async function userIdByCustomerId(customerId: string): Promise<string | null> {
  const [row] = await db
    .select({ userId: subscriptions.userId })
    .from(subscriptions)
    .where(eq(subscriptions.stripeCustomerId, customerId))
    .limit(1);
  return row?.userId ?? null;
}

export async function POST(request: Request) {
  const body = await request.text();
  const signature = (await headers()).get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json(
      { error: "STRIPE_WEBHOOK_SECRET is not set." },
      { status: 500 },
    );
  }

  const stripe = getStripe();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature ?? "", webhookSecret);
  } catch {
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  try {
    switch (event.type) {
      // One-time pay-as-you-go top-up.
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        if (!userId || session.metadata?.kind !== "topup") break;
        const tokens =
          Number(session.metadata.tokens) ||
          paygTokensForEur(Number(session.metadata.amountEur) || 0);
        if (tokens > 0) {
          await grantPrepaidTokens(userId, tokens, {
            provider: "stripe",
            sessionId: session.id,
          });
        }
        break;
      }

      // Record Stripe IDs when the subscription object is first created.
      case "customer.subscription.created": {
        const sub = event.data.object as Stripe.Subscription;
        const userId = sub.metadata?.userId;
        if (!userId) break;
        await db
          .update(subscriptions)
          .set({
            stripeCustomerId: String(sub.customer),
            stripeSubscriptionId: sub.id,
            updatedAt: new Date(),
          })
          .where(eq(subscriptions.userId, userId));
        break;
      }

      // Payment succeeded: (re)activate a plan with a fresh period.
      // Covers first purchase (subscription_create) and renewals (subscription_cycle).
      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        if (
          invoice.billing_reason !== "subscription_create" &&
          invoice.billing_reason !== "subscription_cycle"
        ) {
          break;
        }
        const customerId =
          typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
        if (!customerId) break;
        const userId = await userIdByCustomerId(customerId);
        if (!userId) break;
        const planId = planIdFromPriceId(
          priceIdOf(invoice.lines.data[0]?.pricing?.price_details?.price),
        );
        if (planId) await activatePlan(userId, planId);
        break;
      }

      // Immediate plan change (upgrade) or status change.
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId =
          typeof sub.customer === "string" ? sub.customer : sub.customer?.id ?? "";
        const userId =
          sub.metadata?.userId ?? (customerId ? await userIdByCustomerId(customerId) : null);
        if (!userId) break;
        const planId = planIdFromPriceId(priceIdOf(sub.items.data[0]?.price));
        if (!planId) break;
        if (sub.status === "active" || sub.status === "trialing") {
          await activatePlan(userId, planId);
        } else if (sub.status === "past_due" || sub.status === "unpaid") {
          await db
            .update(subscriptions)
            .set({ status: "past_due", updatedAt: new Date() })
            .where(eq(subscriptions.userId, userId));
        }
        break;
      }

      // Period ended: apply pending downgrade (re-subscribe) or fall back to free.
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId =
          typeof sub.customer === "string" ? sub.customer : sub.customer?.id ?? "";
        const userId =
          sub.metadata?.userId ?? (customerId ? await userIdByCustomerId(customerId) : null);
        if (!userId) break;

        const [row] = await db
          .select()
          .from(subscriptions)
          .where(eq(subscriptions.userId, userId))
          .limit(1);
        const pending = row?.pendingPlanId as PlanId | null | undefined;

        if (pending && pending !== "free") {
          try {
            const renewed = await stripe.subscriptions.create({
              customer: String(sub.customer),
              items: [{ price: priceIdForPlan(pending) }],
              metadata: { userId, planId: pending },
            });
            if (renewed.status === "active" || renewed.status === "trialing") {
              await activatePlan(userId, pending);
            }
          } catch {
            await activatePlan(userId, "free");
          }
        } else {
          await activatePlan(userId, "free");
        }

        await db
          .update(subscriptions)
          .set({ pendingPlanId: null, cancelAtPeriodEnd: false, updatedAt: new Date() })
          .where(eq(subscriptions.userId, userId));
        break;
      }
    }
  } catch (err) {
    console.error("Stripe webhook handler failed:", err);
    return NextResponse.json({ error: "Webhook handler failed." }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
