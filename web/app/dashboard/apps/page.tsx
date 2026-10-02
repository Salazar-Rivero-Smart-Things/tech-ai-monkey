import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { integrations } from "@/lib/db/schema";
import { saveIntegrationPermission } from "../actions";

const PROVIDERS = [
  { id: "slack", name: "Slack", description: "Messages, threads, and channels." },
  { id: "google_workspace", name: "Google Workspace", description: "Gmail, Drive, Docs, Calendar." },
  { id: "hubspot", name: "HubSpot", description: "Contacts, deals, and tickets." },
  { id: "google", name: "Google services", description: "Search, Calendar, Maps, and more." },
];

export default async function AppsPage() {
  const session = await auth();
  if (!session?.user) redirect("/signin");

  const rows = await db
    .select()
    .from(integrations)
    .where(eq(integrations.userId, session.user.id));
  const byProvider = new Map(rows.map((r) => [r.provider, r]));

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Apps to connect</h1>
        <p className="text-sm text-zinc-400">
          When the AI needs an app, it will ask your permission first.
        </p>
      </div>

      {PROVIDERS.map((p) => {
        const current = byProvider.get(p.id);
        return (
          <form
            key={p.id}
            action={saveIntegrationPermission}
            className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/50 p-5"
          >
            <input type="hidden" name="provider" value={p.id} />
            <div className="flex items-baseline justify-between">
              <div>
                <div className="font-medium">{p.name}</div>
                <div className="text-sm text-zinc-400">{p.description}</div>
              </div>
              <span className="text-xs text-zinc-500">
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
        );
      })}
    </div>
  );
}
