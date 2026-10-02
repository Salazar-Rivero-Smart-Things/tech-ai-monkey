import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getStripe, priceIdForPlan } from "@/lib/billing/stripe";
import {
  PAID_PLANS,
  isValidPaygAmount,
  paygTokensForEur,
} from "@/lib/billing/plans";
import type { PlanId } from "@/lib/db/schema";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const stripe = getStripe();
  const userId = session.user.id;
  const email = session.user.email ?? undefined;

  // ---- Subscription plan (PRO / Ultra / Bomb) ----
  if (body.kind === "plan") {
    const planId = body.planId as PlanId;
    if (!PAID_PLANS.includes(planId)) {
      return NextResponse.json({ error: "Unknown plan." }, { status: 400 });
    }
    const checkout = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceIdForPlan(planId), quantity: 1 }],
      customer_email: email,
      metadata: { userId, kind: "plan", planId },
      subscription_data: { metadata: { userId, planId } },
      success_url: `${baseUrl}/dashboard?checkout=success`,
      cancel_url: `${baseUrl}/pricing?checkout=cancel`,
    });
    return NextResponse.json({ url: checkout.url });
  }

  // ---- Pay-as-you-go top-up (one-time payment) ----
  if (body.kind === "topup") {
    const amountEur = Number(body.amountEur);
    if (!isValidPaygAmount(amountEur)) {
      return NextResponse.json(
        { error: "Amount must be between €5 and €100." },
        { status: 400 },
      );
    }
    const tokens = paygTokensForEur(amountEur);
    const checkout = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "eur",
            unit_amount: Math.round(amountEur * 100),
            product_data: {
              name: `Tech AI monkey — ${tokens.toLocaleString()} tokens`,
            },
          },
        },
      ],
      customer_email: email,
      metadata: {
        userId,
        kind: "topup",
        amountEur: String(amountEur),
        tokens: String(tokens),
      },
      success_url: `${baseUrl}/dashboard?checkout=success`,
      cancel_url: `${baseUrl}/pricing?checkout=cancel`,
    });
    return NextResponse.json({ url: checkout.url });
  }

  return NextResponse.json({ error: "Unknown kind." }, { status: 400 });
}
