import Link from "next/link";
import { auth } from "@/auth";
import { siteConfig } from "@/lib/site";
import SignOutButton from "@/components/sign-out-button";

const FEATURES = [
  { title: "Searches the whole web", body: "Keeps searching and fetching sources until your issue is actually resolved." },
  { title: "Keeps learning", body: "Remembers your preferences and projects between conversations." },
  { title: "A library of skills", body: "Loads reusable procedures on demand instead of guessing." },
  { title: "Chat history control", body: "Clear or delete your conversations whenever you want." },
  { title: "API keys", body: "Give your own server a key and hook the AI into your systems." },
  { title: "Notebook reminders", body: "Reminders that stay until you mark them done." },
  { title: "App connections", body: "Slack, Google Workspace, and Google — always with your permission." },
  { title: "Fair pricing", body: "Pay only for what you use. Cheaper than the big AI subscriptions." },
];

const PLANS = [
  { name: "Free", price: "€0", tokens: "80,000 tokens / 5 days" },
  { name: "PRO", price: "€40", tokens: "250,000 tokens / 30 days" },
  { name: "Ultra", price: "€75", tokens: "800,000 tokens / 30 days" },
  { name: "Bomb", price: "€105", tokens: "1,200,000 tokens / 30 days" },
];

export default async function HomePage() {
  const session = await auth();
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="flex items-center justify-between border-b border-zinc-800 px-6 py-4">
        <div>
          <span className="font-semibold">{siteConfig.name}</span>
          <span className="ml-2 text-xs text-zinc-500">v{siteConfig.version}</span>
        </div>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/pricing" className="text-zinc-400 hover:text-white">Pricing</Link>
          <Link href="/privacy" className="text-zinc-400 hover:text-white">Privacy</Link>
          <Link href="/terms" className="text-zinc-400 hover:text-white">Terms</Link>
          <Link href="/copyright" className="text-zinc-400 hover:text-white">Legal</Link>
          {session?.user ? (
            <>
              <Link href="/dashboard" className="rounded-lg bg-blue-600 px-3 py-1.5 font-medium hover:bg-blue-500">
                Dashboard
              </Link>
              <SignOutButton className="rounded-lg border border-zinc-700 px-3 py-1.5 hover:bg-zinc-900" />
            </>
          ) : (
            <>
              <Link href="/signin" className="rounded-lg border border-zinc-700 px-3 py-1.5 hover:bg-zinc-900">Sign in</Link>
              <Link href="/signup" className="rounded-lg bg-blue-600 px-3 py-1.5 font-medium hover:bg-blue-500">Get started</Link>
            </>
          )}
        </nav>
      </header>

      <main>
        {/* Model banner — shows the active AI model (first: Monkey, more coming). */}
        <div className="border-b border-zinc-800 bg-gradient-to-r from-emerald-950/50 via-zinc-950 to-zinc-950">
          <div className="mx-auto flex max-w-5xl items-center gap-3 px-6 py-3 text-sm">
            <span className="rounded-full border border-emerald-500/40 bg-emerald-500/15 px-3 py-1 text-xs font-medium text-emerald-300">
              ACTIVE MODEL
            </span>
            <span className="font-semibold">{siteConfig.modelName} {siteConfig.modelVersion}</span>
            <span className="text-zinc-400">· full AI model package — more models coming</span>
          </div>
        </div>

        <section className="mx-auto max-w-4xl px-6 py-20 text-center">
          <h1 className="text-4xl font-bold sm:text-5xl">{siteConfig.tagline}</h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-zinc-400">
            {siteConfig.name} is an up-to-date AI that searches the web until it finds the
            answer, learns from every conversation, and gives you API access for your own
            server — at a fair price.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            {session?.user ? (
              <Link href="/dashboard" className="rounded-lg bg-blue-600 px-5 py-2.5 font-medium hover:bg-blue-500">
                Open dashboard
              </Link>
            ) : (
              <Link href="/signup" className="rounded-lg bg-blue-600 px-5 py-2.5 font-medium hover:bg-blue-500">
                Get started free
              </Link>
            )}
            <Link href="/pricing" className="rounded-lg border border-zinc-700 px-5 py-2.5 hover:bg-zinc-900">
              View pricing
            </Link>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-6 py-12">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
                <div className="font-medium">{f.title}</div>
                <div className="mt-2 text-sm text-zinc-400">{f.body}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-6 py-12">
          <h2 className="text-2xl font-semibold">Plans</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-4">
            {PLANS.map((p) => (
              <div key={p.name} className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
                <div className="font-semibold">{p.name}</div>
                <div className="mt-1 text-2xl font-bold">{p.price}</div>
                <div className="mt-1 text-sm text-zinc-400">{p.tokens}</div>
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm text-zinc-400">
            Pay-as-you-go from €5 to €100 at €0.00016 per token.{" "}
            <Link href="/pricing" className="text-blue-400 hover:underline">See full details</Link>
          </p>
        </section>
      </main>

      <footer className="border-t border-zinc-800 px-6 py-8 text-sm text-zinc-500">
        <div className="mx-auto max-w-5xl space-y-2">
          <p>
            {siteConfig.companyName} · Org. no. {siteConfig.organizationNumber} · {siteConfig.taxCountry}
          </p>
          <p>
            Support:{" "}
            <a className="text-blue-400 hover:underline" href={siteConfig.supportWhatsAppUrl}>
              WhatsApp
            </a>{" "}
            ({siteConfig.supportHours}) · {siteConfig.supportEmail}
          </p>
          <p>© {new Date().getFullYear()} {siteConfig.companyName}. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
