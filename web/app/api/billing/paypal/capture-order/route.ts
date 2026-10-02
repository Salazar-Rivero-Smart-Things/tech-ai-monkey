import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { captureOrder } from "@/lib/billing/paypal";
import { activatePlan, grantPrepaidTokens } from "@/lib/billing/service";
import { paygTokensForEur } from "@/lib/billing/plans";
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
  const orderId = typeof body.orderId === "string" ? body.orderId : "";
  if (!orderId) {
    return NextResponse.json({ error: "orderId is required." }, { status: 400 });
  }

  const captured = await captureOrder(orderId);
  const rawMeta = captured.purchase_units?.[0]?.custom_id;
  let meta: Record<string, string> = {};
  try {
    meta = rawMeta ? JSON.parse(rawMeta) : {};
  } catch {
    return NextResponse.json({ error: "Order metadata missing." }, { status: 400 });
  }

  if (meta.kind === "topup") {
    const tokens = Number(meta.tokens) || paygTokensForEur(Number(meta.amountEur) || 0);
    if (tokens > 0) {
      await grantPrepaidTokens(session.user.id, tokens, { provider: "paypal", orderId });
    }
  } else if (meta.kind === "plan") {
    await activatePlan(session.user.id, meta.planId as PlanId);
  }

  return NextResponse.json({ ok: true });
}
