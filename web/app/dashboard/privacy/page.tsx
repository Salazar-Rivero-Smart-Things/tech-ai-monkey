import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { deleteMyAccount } from "../actions";

export const dynamic = "force-dynamic";

export default async function PrivacyDataPage() {
  const session = await auth();
  if (!session?.user) redirect("/signin");

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Privacy &amp; data</h1>
        <p className="text-sm text-zinc-400">
          You are in control of your data. You can take a copy of it, or delete your
          account and everything in it. This is the same right described in our{" "}
          <a className="text-blue-400 hover:underline" href="/privacy">
            privacy policy
          </a>
          .
        </p>
      </div>

      <section className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
        <h2 className="font-medium">Download your data</h2>
        <p className="text-sm text-zinc-400">
          Get a machine-readable copy (JSON) of your profile, subscription, token
          history, notebooks, artifacts and connected apps. Passwords and access
          tokens are never included.
        </p>
        <a
          href="/api/account/export"
          className="inline-block rounded-lg border border-zinc-700 px-4 py-2 text-sm hover:bg-zinc-900"
        >
          Download my data (.json)
        </a>
      </section>

      <section className="space-y-3 rounded-xl border border-red-900 bg-red-950/30 p-5">
        <h2 className="font-medium text-red-300">Delete account and all data</h2>
        <p className="text-sm text-zinc-400">
          This permanently deletes your account and every row we store for you
          (profile, subscription, tokens, notebooks, artifacts, connections and
          audit log). <strong>This cannot be undone.</strong>
        </p>
        <form action={deleteMyAccount} className="space-y-3">
          <label className="flex items-start gap-2 text-sm text-zinc-300">
            <input type="checkbox" required className="mt-0.5" />
            <span>
              I understand this permanently deletes my account and all of my data.
            </span>
          </label>
          <button
            type="submit"
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500"
          >
            Permanently delete my account
          </button>
        </form>
      </section>
    </div>
  );
}
