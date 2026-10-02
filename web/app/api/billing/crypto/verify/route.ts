import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { verifyPayment, type CryptoAsset } from "@/lib/billing/crypto";
import { activatePlan, grantPrepaidTokens } from "@/lib/billing/service";
import { PLANS, PAID_PLANS, isValidPaygAmount, paygTokensForEur } from "@/lib/billing/plans";
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

  const asset = body.asset as CryptoAsset;
  const txHash = typeof body.txHash === "string" ? body.txHash.trim() : "";
  if (!["btc", "eth", "usdc", "bch"].includes(asset)) {
    return NextResponse.json({ error: "Unknown asset." }, { status: 400 });
  }
  if (!txHash) {
    return NextResponse.json({ error: "txHash is required." }, { status: 400 });
  }

  let expectedEur = 0;
  let kind = "";
  let planId: PlanId | null = null;
  let topupEur = 0;

  if (body.kind === "plan") {
    planId = body.planId as PlanId;
    if (!PAID_PLANS.includes(planId)) {
      return NextResponse.json({ error: "Unknown plan." }, { status: 400 });
    }
    expectedEur = PLANS[planId].priceEur;
    kind = "plan";
  } else if (body.kind === "topup") {
    topupEur = Number(body.amountEur);
    if (!isValidPaygAmount(topupEur)) {
      return NextResponse.json(
        { error: "Amount must be between €5 and €100." },
        { status: 400 },
      );
    }
    expectedEur = topupEur;
    kind = "topup";
  } else {
    return NextResponse.json({ error: "Unknown kind." }, { status: 400 });
  }

  await verifyPayment(asset, txHash, expectedEur);

  if (kind === "plan" && planId) {
    await activatePlan(session.user.id, planId);
  } else if (kind === "topup") {
    await grantPrepaidTokens(session.user.id, paygTokensForEur(topupEur), {
      provider: "crypto",
      asset,
      txHash,
    });
  }

  return NextResponse.json({ ok: true });
}
