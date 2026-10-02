import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { subscriptions, type PlanId } from "@/lib/db/schema";
import { getStripe } from "@/lib/billing/stripe";
import { PAID_PLANS } from "@/lib/billing/plans";

// Cancel or schedule a downgrade. Both keep the current plan active until the
// current 30-day period ends; the Stripe webhook applies the change afterward.
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const userId = session.user.id;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .limit(1);

  if (!sub?.stripeSubscriptionId) {
    return NextResponse.json(
      { error: "No active Stripe subscription." },
      { status: 400 },
    );
  }

  const stripe = getStripe();
  const action = body.action;

  if (action === "cancel") {
    await stripe.subscriptions.update(sub.stripeSubscriptionId, {
      cancel_at_period_end: true,
    });
    await db
      .update(subscriptions)
      .set({
        cancelAtPeriodEnd: true,
        pendingPlanId: "free",
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.userId, userId));
    return NextResponse.json({ ok: true, message: "Canceled at period end." });
  }

  if (action === "downgrade") {
    const planId = body.planId as PlanId;
    if (!PAID_PLANS.includes(planId)) {
      return NextResponse.json({ error: "Unknown plan." }, { status: 400 });
    }
    await stripe.subscriptions.update(sub.stripeSubscriptionId, {
      cancel_at_period_end: true,
    });
    await db
      .update(subscriptions)
      .set({
        cancelAtPeriodEnd: true,
        pendingPlanId: planId,
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.userId, userId));
    return NextResponse.json({
      ok: true,
      message: `Downgrade to ${planId.toUpperCase()} scheduled for the end of this period.`,
    });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
