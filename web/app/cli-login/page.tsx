import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  createAuthCode,
  isValidPkceChallenge,
  isValidRedirectPort,
  isValidState,
} from "@/lib/cli-auth";
import { isUnlimited } from "@/lib/entitlements";
import { siteConfig } from "@/lib/site";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

export default async function CliLoginPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const port = Number.parseInt(first(params.port), 10);
  const state = first(params.state);
  const challenge = first(params.challenge);
  const clientName = first(params.name).slice(0, 60) || `${siteConfig.name} CLI`;

  const selfUrl = `/cli-login?${new URLSearchParams({
    port: String(port),
    state,
    challenge,
    name: clientName,
  }).toString()}`;

  const valid =
    isValidRedirectPort(port) && isValidPkceChallenge(challenge) && isValidState(state);

  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/signin?callbackUrl=${encodeURIComponent(selfUrl)}`);
  }

  async function approve() {
    "use server";
    const current = await auth();
    if (!current?.user?.id) redirect(`/signin?callbackUrl=${encodeURIComponent(selfUrl)}`);

    const code = await createAuthCode({
      userId: current.user.id,
      codeChallenge: challenge,
      redirectPort: port,
      clientName,
    });

    const callback = new URL(`http://127.0.0.1:${port}/callback`);
    callback.searchParams.set("code", code);
    callback.searchParams.set("state", state);
    redirect(callback.toString());
  }

  const unlimited = isUnlimited({
    id: session.user.id,
    email: session.user.email,
    role: session.user.role,
  });

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800 px-6 py-4">
        <Link href="/" className="font-semibold">
          {siteConfig.name}
        </Link>
      </header>
      <main className="mx-auto max-w-lg px-6 py-16">
        {!valid ? (
          <div className="rounded-lg border border-red-900 bg-red-950/40 p-6">
            <h1 className="text-xl font-semibold text-red-200">Invalid login request</h1>
            <p className="mt-3 text-sm text-red-200/80">
              The link is missing a valid callback port, state or PKCE challenge. Run
              <code className="mx-1 rounded bg-black/40 px-1.5 py-0.5">tech-ai login</code>
              again to get a fresh link.
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-6">
            <h1 className="text-xl font-semibold">Authorize {clientName}</h1>
            <p className="mt-3 text-sm text-zinc-400">
              A program on <span className="text-zinc-200">this computer</span> is asking to
              sign in to your {siteConfig.name} account.
            </p>

            <dl className="mt-5 space-y-2 rounded-md border border-zinc-800 bg-zinc-950/60 p-4 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-zinc-500">Account</dt>
                <dd className="truncate text-zinc-200">{session.user.email}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-zinc-500">Plan</dt>
                <dd className={unlimited ? "text-emerald-400" : "text-zinc-200"}>
                  {unlimited ? "Unlimited (owner)" : "Metered"}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-zinc-500">Returns to</dt>
                <dd className="font-mono text-xs text-zinc-300">127.0.0.1:{port}</dd>
              </div>
            </dl>

            <form action={approve} className="mt-6 flex gap-3">
              <button
                type="submit"
                className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
              >
                Authorize
              </button>
              <Link
                href="/dashboard"
                className="rounded-md border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
              >
                Cancel
              </Link>
            </form>

            <p className="mt-4 text-xs text-zinc-500">
              Only approve this if you just ran <code>tech-ai login</code>. The access token is
              stored locally in <code>~/.config/tech-ai/credentials.json</code> and can be revoked
              from Dashboard → API keys.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
