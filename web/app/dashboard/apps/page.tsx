import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { integrations } from "@/lib/db/schema";
import { PROVIDER_IDS, PROVIDERS, getCredentials } from "@/lib/integrations/providers";
import { saveIntegrationPermission } from "../actions";

export const dynamic = "force-dynamic";

interface IntegrationMetadata {
  account?: string | null;
  connectedAt?: string;
  scopes?: string | null;
}

function statusBanner(searchParams: {
  error?: string;
  connected?: string;
  provider?: string;
}): { kind: "ok" | "warn" | "err"; text: string } | null {
  const { error, connected, provider } = searchParams;
  const cfg = provider && PROVIDER_IDS.includes(provider as never)
    ? PROVIDERS[provider as keyof typeof PROVIDERS]
    : undefined;

  if (connected) return { kind: "ok", text: `${cfg?.name ?? "That app"} is connected.` };
  if (!error) return null;

  if (error === "not_configured") {
    return {
      kind: "warn",
      text: cfg
        ? `${cfg.name} is not set up yet. Add ${cfg.clientIdEnv} and ${cfg.clientSecretEnv} to web/.env.local, then restart the web app.`
        : "That app is not set up yet.",
    };
  }

  const friendly: Record<string, string> = {
    unknown_provider: "Unknown app.",
    missing_code: "The app did not return an authorization code.",
    bad_state: "The security check failed. Please try connecting again.",
    session_mismatch: "Your session changed during the connection. Please try again.",
    access_denied: "You declined the permission request.",
    no_access_token: "The app did not return an access token.",
  };
  return { kind: "err", text: friendly[error] ?? `Connection failed (${error}).` };
}

export default async function AppsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; connected?: string; provider?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/signin");

  const sp = await searchParams;
  const note = statusBanner(sp);

  const rows = await db
    .select()
    .from(integrations)
    .where(eq(integrations.userId, session.user.id));
  const byProvider = new Map(rows.map((r) => [r.provider, r]));

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Apps to connect</h1>
        <p className="text-sm text-zinc-400">
          When the AI needs an app, it will ask your permission first. Connecting an
          app happens through the provider&apos;s own secure login — this app never
          sees your password.
        </p>
      </div>

      {note && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            note.kind === "ok"
              ? "border-emerald-800 bg-emerald-950/40 text-emerald-300"
              : note.kind === "warn"
                ? "border-amber-800 bg-amber-950/40 text-amber-300"
                : "border-red-900 bg-red-950/40 text-red-300"
          }`}
        >
          {note.text}
        </div>
      )}

      {PROVIDER_IDS.map((id) => {
        const p = PROVIDERS[id];
        const current = byProvider.get(id);
        const meta = (current?.metadata ?? {}) as IntegrationMetadata;
        const connected = current?.status === "connected";
        const configured = getCredentials(p) !== null;
        const redirectUri = `${appUrl}/api/integrations/${id}/callback`;

        return (
          <div
            key={id}
            className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/50 p-5"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="font-medium">{p.name}</div>
                <div className="text-sm text-zinc-400">{p.description}</div>
              </div>
              <span
                className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs ${
                  connected
                    ? "border-emerald-700 bg-emerald-950/50 text-emerald-300"
                    : "border-zinc-700 text-zinc-500"
                }`}
              >
                {connected ? "Connected" : current ? "Not connected" : "Not set"}
              </span>
            </div>

            {connected ? (
              <div className="text-sm text-zinc-400">
                Connected{meta.account ? ` as ${meta.account}` : ""}.
              </div>
            ) : configured ? (
              <a
                href={`/api/integrations/${id}/connect`}
                className="inline-block rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium hover:bg-blue-500"
              >
                Connect {p.name}
              </a>
            ) : (
              <div className="space-y-2 rounded-lg border border-zinc-800 bg-zinc-950/60 p-3 text-sm">
                <div className="text-amber-300">Not set up yet — needs credentials.</div>
                <div className="text-zinc-400">
                  Add these to <code className="text-zinc-300">web/.env.local</code> and restart:
                </div>
                <ul className="ml-4 list-disc text-zinc-400">
                  <li>
                    <code className="text-zinc-300">{p.clientIdEnv}</code>
                  </li>
                  <li>
                    <code className="text-zinc-300">{p.clientSecretEnv}</code>
                  </li>
                </ul>
                <div className="text-zinc-400">
                  Redirect URI to register:{" "}
                  <code className="text-zinc-300">{redirectUri}</code>
                </div>
                <div className="flex flex-wrap gap-3 pt-1">
                  <a
                    className="text-blue-400 hover:underline"
                    href={p.setupUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Create the app ↗
                  </a>
                  <a
                    className="text-blue-400 hover:underline"
                    href={p.docsUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Docs ↗
                  </a>
                </div>
              </div>
            )}

            <form
              action={saveIntegrationPermission}
              className="space-y-3 border-t border-zinc-800 pt-4"
            >
              <input type="hidden" name="provider" value={id} />
              <div className="text-xs uppercase tracking-wide text-zinc-500">
                Permission
                <span className="ml-2 normal-case text-zinc-400">
                  {current ? (current.permission === "no" ? "Declined" : "Allowed") : "Not set"}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {[
                  ["yes", "Yes, you can"],
                  ["yes_this_project", "Yes, for this project"],
                  ["no", "No"],
                ].map(([value, label]) => (
                  <label key={value} className="flex items-center gap-1.5 text-sm">
                    <input
                      type="radio"
                      name="permission"
                      value={value}
                      defaultChecked={current?.permission === value}
                    />
                    {label}
                  </label>
                ))}
              </div>
              <input
                name="note"
                placeholder="Add a note (optional)"
                defaultValue={current?.permissionNote ?? ""}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2.5"
              />
              <button className="rounded-lg bg-blue-600 px-4 py-2 font-medium hover:bg-blue-500">
                Save permission
              </button>
            </form>
          </div>
        );
      })}
    </div>
  );
}
