"use client";

import { useEffect, useState } from "react";

interface CliKey {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("nb-NO", { year: "numeric", month: "short", day: "numeric" });
}

export default function ApiKeyManager({ unlimited }: { unlimited: boolean }) {
  const [keys, setKeys] = useState<CliKey[]>([]);
  const [name, setName] = useState("");
  const [freshToken, setFreshToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/cli/keys", { cache: "no-store" });
      const data = (await res.json()) as { keys?: CliKey[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not load keys.");
      setKeys(data.keys ?? []);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load keys.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function createKey() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/cli/keys", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: name.trim() || "CLI" }),
      });
      const data = (await res.json()) as { token?: string; error?: string };
      if (!res.ok || !data.token) throw new Error(data.error ?? "Could not create the key.");
      setFreshToken(data.token);
      setName("");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create the key.");
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: string) {
    setBusy(true);
    try {
      await fetch(`/api/cli/keys?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {unlimited && (
        <div className="rounded-lg border border-emerald-900 bg-emerald-950/30 p-4 text-sm text-emerald-200">
          <strong className="font-semibold">Owner account — unlimited.</strong> Your tokens are never
          metered and you never hit a paywall, in the web app or through the CLI.
        </div>
      )}

      <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-5">
        <h2 className="text-base font-semibold">Create a key</h2>
        <p className="mt-1 text-sm text-zinc-400">
          Use a key in the terminal (<code>tech-ai login --key …</code>) or from your own server.
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Name (e.g. laptop, server)"
            className="flex-1 rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-emerald-600"
          />
          <button
            onClick={() => void createKey()}
            disabled={busy}
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            Create key
          </button>
        </div>

        {freshToken && (
          <div className="mt-4 rounded-md border border-amber-800 bg-amber-950/30 p-4">
            <p className="text-sm text-amber-200">
              Copy this key now — it is shown <strong>only once</strong>.
            </p>
            <code className="mt-2 block break-all rounded bg-black/50 p-2 font-mono text-xs text-amber-100">
              {freshToken}
            </code>
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => void navigator.clipboard.writeText(freshToken)}
                className="rounded border border-amber-700 px-3 py-1 text-xs text-amber-100 hover:bg-amber-900/40"
              >
                Copy
              </button>
              <button
                onClick={() => setFreshToken(null)}
                className="rounded border border-zinc-700 px-3 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-zinc-800 bg-zinc-900/40">
        <h2 className="border-b border-zinc-800 px-5 py-3 text-base font-semibold">Your keys</h2>
        {loading ? (
          <p className="px-5 py-4 text-sm text-zinc-400">Loading…</p>
        ) : keys.length === 0 ? (
          <p className="px-5 py-4 text-sm text-zinc-400">No keys yet.</p>
        ) : (
          <ul className="divide-y divide-zinc-800">
            {keys.map((key) => (
              <li key={key.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
                <span className="font-mono text-zinc-300">{key.prefix}…</span>
                <span className="text-zinc-200">{key.name}</span>
                <span className="text-xs text-zinc-500">
                  created {formatDate(key.createdAt)} · last used {formatDate(key.lastUsedAt)}
                </span>
                <button
                  onClick={() => void revoke(key.id)}
                  disabled={busy}
                  className="ml-auto rounded border border-red-900 px-3 py-1 text-xs text-red-300 hover:bg-red-950/40 disabled:opacity-50"
                >
                  Revoke
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {error && (
        <p className="rounded-md border border-red-900 bg-red-950/30 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      )}

      <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-5 text-sm text-zinc-400">
        <h2 className="text-base font-semibold text-zinc-100">Command line</h2>
        <p className="mt-2">Download the CLI and sign in:</p>
        <pre className="mt-3 overflow-x-auto rounded bg-black/50 p-3 font-mono text-xs text-zinc-300">{`tech-ai login                 # browser (Google or e-mail)
tech-ai login --key tai_...   # paste an API key
tech-ai ask "hello"
tech-ai chat`}</pre>
        <p className="mt-3">
          Get the installer at <a className="text-blue-400 hover:underline" href="/download">/download</a>.
        </p>
      </div>
    </div>
  );
}
