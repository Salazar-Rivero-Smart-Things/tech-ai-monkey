import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getBillingState } from "@/lib/billing/service";
import { isUnlimited } from "@/lib/entitlements";
import SubscriptionManager from "@/components/subscription-manager";

export default async function SubscriptionPage() {
  const session = await auth();
  if (!session?.user) redirect("/signin");

  const unlimited = isUnlimited({
    id: session.user.id,
    email: session.user.email,
    role: session.user.role,
  });

  if (unlimited) {
    return (
      <div className="max-w-3xl space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Subscription</h1>
          <p className="text-sm text-zinc-400">Owner account.</p>
        </div>
        <div className="rounded-xl border border-emerald-900 bg-emerald-950/30 p-6">
          <h2 className="text-lg font-semibold text-emerald-200">Unlimited</h2>
          <p className="mt-2 text-sm text-emerald-100/80">
            This account is the owner of the instance. Tokens are never metered, no paywall is
            applied, and nothing needs to be purchased — on the website or through the CLI.
          </p>
          <p className="mt-3 text-xs text-emerald-200/60">
            To change this later, remove the account from the admin role (or from{" "}
            <code>OWNER_EMAILS</code> in <code>web/.env.local</code>) and restart the web app.
          </p>
        </div>
      </div>
    );
  }

  const state = await getBillingState(session.user.id);

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Subscription</h1>
        <p className="text-sm text-zinc-400">
          Upgrade takes effect immediately; downgrades and cancellations apply
          at the end of the current 30-day period.
        </p>
      </div>
      <SubscriptionManager currentPlan={state.plan} prepaidTokens={state.prepaidTokens} />
    </div>
  );
}
