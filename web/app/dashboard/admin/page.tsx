import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { users, subscriptions, tokenBalances } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user) redirect("/signin");
  if (session.user.role !== "admin") redirect("/dashboard");

  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      createdAt: users.createdAt,
      plan: subscriptions.plan,
      tokenAllowance: subscriptions.tokenAllowance,
      tokensUsed: subscriptions.tokensUsed,
      prepaidTokens: tokenBalances.prepaidTokens,
    })
    .from(users)
    .leftJoin(subscriptions, eq(subscriptions.userId, users.id))
    .leftJoin(tokenBalances, eq(tokenBalances.userId, users.id))
    .orderBy(desc(users.createdAt));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Admin</h1>
        <p className="text-sm text-zinc-400">
          {rows.length} {rows.length === 1 ? "account" : "accounts"} registered.
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-900 text-zinc-400">
            <tr>
              <th className="px-4 py-2 font-medium">User</th>
              <th className="px-4 py-2 font-medium">Role</th>
              <th className="px-4 py-2 font-medium">Plan</th>
              <th className="px-4 py-2 font-medium">Tokens left</th>
              <th className="px-4 py-2 font-medium">Joined</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr className="border-t border-zinc-800">
                <td className="px-4 py-4 text-zinc-500" colSpan={5}>
                  No accounts yet.
                </td>
              </tr>
            )}
            {rows.map((u) => {
              const left =
                (u.tokenAllowance ?? 0) - (u.tokensUsed ?? 0) + (u.prepaidTokens ?? 0);
              return (
                <tr key={u.id} className="border-t border-zinc-800">
                  <td className="px-4 py-2">
                    <div className="font-medium">{u.name ?? "—"}</div>
                    <div className="text-xs text-zinc-500">{u.email}</div>
                  </td>
                  <td className="px-4 py-2">
                    <span className={u.role === "admin" ? "text-amber-400" : "text-zinc-400"}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-2 uppercase text-zinc-300">{u.plan ?? "—"}</td>
                  <td className="px-4 py-2 text-zinc-300">{left.toLocaleString()}</td>
                  <td className="px-4 py-2 text-zinc-500">
                    {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
