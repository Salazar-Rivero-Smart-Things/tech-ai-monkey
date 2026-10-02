import Link from "next/link";
import { siteConfig } from "@/lib/site";

const PLANS = [
  { id: "free", name: "Free", price: "€0", tokens: "80,000", period: "every 5 days" },
  { id: "pro", name: "PRO", price: "€40", tokens: "250,000", period: "per 30 days" },
  { id: "ultra", name: "Ultra", price: "€75", tokens: "800,000", period: "per 30 days" },
  { id: "bomb", name: "Bomb", price: "€105", tokens: "1,200,000", period: "per 30 days" },
];

const TOPUPS = [
  { eur: 5, tokens: 31250 },
  { eur: 10, tokens: 62500 },
  { eur: 20, tokens: 125000 },
  { eur: 50, tokens: 312500 },
  { eur: 100, tokens: 625000 },
];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="flex items-center justify-between border-b border-zinc-800 px-6 py-4">
        <Link href="/" className="font-semibold">{siteConfig.name}</Link>
        <Link href="/signup" className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium hover:bg-blue-500">
          Get started
        </Link>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-12">
        <h1 className="text-3xl font-bold">Pricing & tokens</h1>
        <p className="mt-2 text-zinc-400">
          Simple, fair pricing — cheaper than the big AI subscriptions.
        </p>

        <h2 className="mt-10 text-xl font-semibold">Subscriptions (30-day periods)</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PLANS.map((p) => (
            <div key={p.id} className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
              <div className="font-semibold">{p.name}</div>
              <div className="mt-1 text-2xl font-bold">{p.price}</div>
              <div className="mt-1 text-sm text-zinc-400">{p.tokens} tokens</div>
              <div className="text-xs text-zinc-500">{p.period}</div>
            </div>
          ))}
        </div>

        <ul className="mt-6 list-disc space-y-2 pl-6 text-sm text-zinc-400">
          <li><strong className="text-zinc-200">Free:</strong> 80,000 tokens every 5 days. If you use them early, you can either buy pay-as-you-go to continue immediately, or wait 7 days for the next free refill.</li>
          <li><strong className="text-zinc-200">Upgrade:</strong> takes effect immediately.</li>
          <li><strong className="text-zinc-200">Downgrade or cancel:</strong> keeps your current plan until the current 30-day period ends.</li>
          <li><strong className="text-zinc-200">Exhausted?</strong> We'll remind you to upgrade or top up — with an optional Google Calendar reminder.</li>
        </ul>

        <h2 className="mt-10 text-xl font-semibold">Pay-as-you-go (prepaid)</h2>
        <p className="mt-2 text-sm text-zinc-400">
          Top up €5–€100 any time at <strong className="text-zinc-200">€0.00016 per token</strong>.
        </p>
        <div className="mt-4 overflow-hidden rounded-xl border border-zinc-800">
          <table className="w-full text-sm">
            <thead className="bg-zinc-900">
              <tr className="text-left text-zinc-400">
                <th className="px-4 py-2 font-medium">Pay</th>
                <th className="px-4 py-2 font-medium">Tokens you get</th>
              </tr>
            </thead>
            <tbody>
              {TOPUPS.map((t) => (
                <tr key={t.eur} className="border-t border-zinc-800">
                  <td className="px-4 py-2">€{t.eur}</td>
                  <td className="px-4 py-2">{t.tokens.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-zinc-500">
          Prepaid tokens never expire and are spent after your subscription allowance.
        </p>

        <h2 className="mt-10 text-xl font-semibold">Payment methods</h2>
        <p className="mt-2 text-sm text-zinc-400">
          PayPal · Google Pay · Apple Pay · card (Stripe) · cryptocurrency (BTC, ETH, BCH directly to our wallet).
        </p>
      </main>
    </div>
  );
}
