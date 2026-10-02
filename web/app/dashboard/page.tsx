import { auth } from "@/auth";
import { getBillingState } from "@/lib/billing/service";
import { PLANS } from "@/lib/billing/plans";
import { siteConfig } from "@/lib/site";

export default async function DashboardPage() {
  const session = await auth();
  const state = session?.user
    ? await getBillingState(session.user.id)
    : null;

  const plan = state ? PLANS[state.plan] : null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">
          Welcome back{session?.user?.name ? `, ${session.user.name.split(" ")[0]}` : ""}
        </h1>
        <p className="text-sm text-zinc-400">
          {siteConfig.name} · your learning AI
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
          <div className="text-sm text-zinc-400">Plan</div>
          <div className="mt-1 text-xl font-semibold">{plan?.name ?? "—"}</div>
          <div className="mt-1 text-xs text-zinc-500">
            renews {state ? state.currentPeriodEnd.toLocaleDateString() : ""}
          </div>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
          <div className="text-sm text-zinc-400">Subscription tokens left</div>
          <div className="mt-1 text-xl font-semibold">
            {state ? state.subscriptionRemaining.toLocaleString() : "—"}
          </div>
          <div className="mt-1 text-xs text-zinc-500">
            of {state ? state.tokenAllowance.toLocaleString() : "—"} this period
          </div>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
          <div className="text-sm text-zinc-400">Prepaid (pay-as-you-go)</div>
          <div className="mt-1 text-xl font-semibold">
            {state ? state.prepaidTokens.toLocaleString() : "—"}
          </div>
          <div className="mt-1 text-xs text-zinc-500">
            {state ? state.totalRemaining.toLocaleString() : "—"} total available
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-5 text-sm text-zinc-400">
        Need help? WhatsApp{" "}
        <a className="text-blue-400 hover:underline" href={siteConfig.supportWhatsAppUrl}>
          {siteConfig.supportWhatsAppUrl.replace("https://", "")}
        </a>{" "}
        · {siteConfig.supportHours} · {siteConfig.supportEmail}
      </div>
    </div>
  );
}
