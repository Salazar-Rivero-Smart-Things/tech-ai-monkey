"use client";

import { useState } from "react";
import Link from "next/link";

export default function SignUpPage() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
    country: "",
    address: "",
    postalCode: "",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function update(key: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        setBusy(false);
        return;
      }
      window.location.href = "/signin?registered=1";
    } catch {
      setError("Network error. Try again.");
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 p-6 text-zinc-100">
      <div className="w-full max-w-md space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Create your account</h1>
          <p className="text-sm text-zinc-400">Tech AI monkey · v1.0.0</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
          <input required placeholder="Full name" value={form.name}
            onChange={(e) => update("name", e.target.value)}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2.5" />
          <input required type="email" placeholder="Email" value={form.email}
            onChange={(e) => update("email", e.target.value)}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2.5" />
          <input required type="password" minLength={8} placeholder="Password (8+ characters)" value={form.password}
            onChange={(e) => update("password", e.target.value)}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2.5" />
          <input placeholder="Phone number" value={form.phone}
            onChange={(e) => update("phone", e.target.value)}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2.5" />
          <div className="grid grid-cols-2 gap-3">
            <input placeholder="Country" value={form.country}
              onChange={(e) => update("country", e.target.value)}
              className="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2.5" />
            <input placeholder="Postal code" value={form.postalCode}
              onChange={(e) => update("postalCode", e.target.value)}
              className="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2.5" />
          </div>
          <input placeholder="Address" value={form.address}
            onChange={(e) => update("address", e.target.value)}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2.5" />

          {error && <p className="text-sm text-red-400">{error}</p>}
          <button type="submit" disabled={busy}
            className="w-full rounded-lg bg-blue-600 px-4 py-2.5 font-medium hover:bg-blue-500 disabled:opacity-50">
            {busy ? "Creating…" : "Create account"}
          </button>
        </form>

        <p className="text-center text-sm text-zinc-400">
          Already have an account?{" "}
          <Link href="/signin" className="text-blue-400 hover:underline">Sign in</Link>
        </p>
      </div>
    </main>
  );
}
