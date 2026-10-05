import { NextResponse } from "next/server";
import { getBillingState } from "@/lib/billing/service";
import { resolveCliToken } from "@/lib/cli-tokens";
import { isUnlimited } from "@/lib/entitlements";
import { PLANS } from "@/lib/billing/plans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/cli/me — who is this CLI token, and how much is left?
// Used by `tech-ai whoami` and `tech-ai status`.

function bearerFrom(request: Request): string {
  const header = request.headers.get("authorization") ?? "";
  return header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
}

export async function GET(request: Request) {
  const user = await resolveCliToken(bearerFrom(request));
  if (!user) {
    return NextResponse.json({ ok: false, error: "Invalid or expired token." }, { status: 401 });
  }

  const unlimited = isUnlimited(user);

  if (unlimited) {
    return NextResponse.json({
      ok: true,
      user: { email: user.email, name: user.name, role: user.role },
      unlimited: true,
      plan: "unlimited",
      tokensRemaining: null,
      message: "Unlimited — owner account, no token metering.",
    });
  }

  const billing = await getBillingState(user.id);
  return NextResponse.json({
    ok: true,
    user: { email: user.email, name: user.name, role: user.role },
    unlimited: false,
    plan: billing.plan,
    planName: PLANS[billing.plan].name,
    tokensRemaining: billing.totalRemaining,
    subscriptionRemaining: billing.subscriptionRemaining,
    prepaidTokens: billing.prepaidTokens,
    periodEndsAt: billing.currentPeriodEnd,
  });
}
