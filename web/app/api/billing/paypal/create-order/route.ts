import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createOrder } from "@/lib/billing/paypal";
import { PLANS, PAID_PLANS, isValidPaygAmount, paygTokensForEur } from "@/lib/billing/plans";
import type { PlanId } from "@/lib/db/schema";

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

  if (body.kind === "plan") {
    const planId = body.planId as PlanId;
    if (!PAID_PLANS.includes(planId)) {
      return NextResponse.json({ error: "Unknown plan." }, { status: 400 });
    }
    const plan = PLANS[planId];
    const order = await createOrder({
      amountEur: plan.priceEur,
      description: `Tech AI monkey — ${plan.name} (30 days)`,
      metadata: { userId, kind: "plan", planId },
    });
    return NextResponse.json(order);
  }

  if (body.kind === "topup") {
    const amountEur = Number(body.amountEur);
    if (!isValidPaygAmount(amountEur)) {
      return NextResponse.json(
        { error: "Amount must be between €5 and €100." },
        { status: 400 },
      );
    }
    const tokens = paygTokensForEur(amountEur);
    const order = await createOrder({
      amountEur,
      description: `Tech AI monkey — ${tokens.toLocaleString()} tokens`,
      metadata: {
        userId,
        kind: "topup",
        amountEur: String(amountEur),
        tokens: String(tokens),
      },
    });
    return NextResponse.json(order);
  }

  return NextResponse.json({ error: "Unknown kind." }, { status: 400 });
}
