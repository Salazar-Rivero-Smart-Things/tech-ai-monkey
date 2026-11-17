"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";

function getAuthErrorMessage(code: string) {
  switch (code) {
    case "CredentialsSignin":
      return "Invalid email or password.";
    case "AccessDenied":
      return "Access denied. Please check your credentials or contact support.";
    case "Configuration":
      return "Sign-in service is not configured correctly. Please contact support.";
    default:
      return `Sign-in failed (${code}). Please try again or contact support.`;
  }
}

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("error");
    if (code) setError(getAuthErrorMessage(code));
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await signIn("credentials", { email, password, redirect: false });
    if (res?.error) {
      setError("Invalid email or password.");
      setBusy(false);
    } else {
      window.location.href = "/dashboard";
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 p-6 text-zinc-100">
      <div className="w-full max-w-sm space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Tech AI monkey</h1>
          <p className="text-sm text-zinc-400">Sign in to continue.</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2.5"
          />
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2.5"
          />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-blue-600 px-4 py-2.5 font-medium hover:bg-blue-500 disabled:opacity-50"
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="text-center text-sm text-zinc-400">
          No account?{" "}
          <Link href="/signup" className="text-blue-400 hover:underline">
            Create one
          </Link>
        </p>
      </div>
    </main>
  );
}
