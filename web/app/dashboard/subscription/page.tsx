import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getBillingState } from "@/lib/billing/service";
import SubscriptionManager from "@/components/subscription-manager";

export default async function SubscriptionPage() {
  const session = await auth();
  if (!session?.user) redirect("/signin");

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
