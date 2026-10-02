"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PLANS, PAID_PLANS, PAYG_MIN_EUR, PAYG_MAX_EUR } from "@/lib/billing/plans";

const RANK = ["free", "pro", "ultra", "bomb"];

export default function SubscriptionManager({
  currentPlan,
  prepaidTokens,
}: {
  currentPlan: string;
  prepaidTokens: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [amount, setAmount] = useState("10");
  const [message, setMessage] = useState("");

  async function post(path: string, body: Record<string, unknown>) {
    const res = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.json();
  }

  async function choosePlan(planId: string) {
    setBusy(planId);
    setMessage("");
    const data = await post("/api/billing/checkout", { kind: "plan", planId });
    if (data.url) window.location.href = data.url;
    else setMessage(data.error ?? "Something went wrong.");
    setBusy(null);
  }

  async function topUp() {
    setBusy("topup");
    setMessage("");
    const data = await post("/api/billing/checkout", {
      kind: "topup",
      amountEur: Number(amount),
    });
    if (data.url) window.location.href = data.url;
    else setMessage(data.error ?? "Something went wrong.");
    setBusy(null);
  }

  async function downgradeOrCancel(action: "cancel" | "downgrade", planId?: string) {
    setBusy(action);
    setMessage("");
    const data = await post("/api/billing/subscription", { action, ...(planId ? { planId } : {}) });
    setMessage(data.message ?? data.error ?? "Done.");
    setBusy(null);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
        <div className="text-sm text-zinc-400">Current plan</div>
        <div className="mt-1 text-2xl font-semibold">
          {PLANS[currentPlan as keyof typeof PLANS]?.name ?? currentPlan}
        </div>
        <div className="mt-1 text-sm text-zinc-400">
          Prepaid pay-as-you-go: {prepaidTokens.toLocaleString()} tokens
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {PAID_PLANS.map((id) => {
          const plan = PLANS[id];
          const isCurrent = id === currentPlan;
          return (
            <div key={id} className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
              <div className="font-semibold">{plan.name}</div>
              <div className="mt-1 text-2xl font-bold">€{plan.priceEur}</div>
              <div className="text-sm text-zinc-400">{plan.tokens.toLocaleString()} tokens / 30 days</div>
              {isCurrent ? (
                <div className="mt-4 rounded-lg border border-zinc-700 px-3 py-2 text-center text-sm text-zinc-400">
                  Current plan
                </div>
              ) : (
                <button
                  disabled={busy !== null}
                  onClick={() => choosePlan(id)}
                  className="mt-4 w-full rounded-lg bg-blue-600 px-3 py-2 font-medium hover:bg-blue-500 disabled:opacity-50"
                >
                  {busy === id ? "Opening…" : RANK.indexOf(id) > RANK.indexOf(currentPlan) ? "Upgrade" : "Switch"}
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
        <div className="font-semibold">Pay-as-you-go top-up</div>
        <p className="mt-1 text-sm text-zinc-400">
          €{PAYG_MIN_EUR}–€{PAYG_MAX_EUR} prepaid at €0.00016/token (31,250 tokens per €5).
        </p>
        <div className="mt-3 flex gap-3">
          <input
            type="number"
            min={PAYG_MIN_EUR}
            max={PAYG_MAX_EUR}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-32 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2"
          />
          <button
            disabled={busy !== null}
            onClick={topUp}
            className="rounded-lg bg-blue-600 px-4 py-2 font-medium hover:bg-blue-500 disabled:opacity-50"
          >
            {busy === "topup" ? "Opening…" : "Top up"}
          </button>
        </div>
      </div>

      {currentPlan !== "free" && (
        <div className="flex flex-wrap gap-3">
          <button
            disabled={busy !== null}
            onClick={() => downgradeOrCancel("downgrade", "pro")}
            className="rounded-lg border border-zinc-700 px-4 py-2 text-sm hover:bg-zinc-900"
          >
            Downgrade to PRO at period end
          </button>
          <button
            disabled={busy !== null}
            onClick={() => downgradeOrCancel("cancel")}
            className="rounded-lg border border-red-900 px-4 py-2 text-sm text-red-400 hover:bg-zinc-900"
          >
            Cancel at period end
          </button>
        </div>
      )}

      {message && <p className="text-sm text-zinc-300">{message}</p>}
    </div>
  );
}
