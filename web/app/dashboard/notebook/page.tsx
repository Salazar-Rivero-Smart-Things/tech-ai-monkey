import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { notebooks } from "@/lib/db/schema";
import { addNotebookItem, toggleNotebookItem, deleteNotebookItem } from "../actions";

export default async function NotebookPage() {
  const session = await auth();
  if (!session?.user) redirect("/signin");

  const items = await db
    .select()
    .from(notebooks)
    .where(eq(notebooks.userId, session.user.id))
    .orderBy(desc(notebooks.createdAt));

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Notebook</h1>
        <p className="text-sm text-zinc-400">
          Reminders that stay until you mark them done.
        </p>
      </div>

      <form action={addNotebookItem} className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
        <input
          name="title"
          required
          placeholder="What do you need to remember?"
          className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2.5"
        />
        <textarea
          name="notes"
          placeholder="Notes (optional)"
          className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2.5"
        />
        <div className="flex items-center gap-3">
          <label className="text-sm text-zinc-400">Remind me at</label>
          <input
            name="remindAt"
            type="datetime-local"
            className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2"
          />
          <button className="ml-auto rounded-lg bg-blue-600 px-4 py-2 font-medium hover:bg-blue-500">
            Add reminder
          </button>
        </div>
      </form>

      {items.length === 0 ? (
        <p className="text-sm text-zinc-500">No reminders yet.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li
              key={item.id}
              className={`rounded-xl border p-4 ${
                item.done
                  ? "border-zinc-800 bg-zinc-900/20 text-zinc-500"
                  : "border-zinc-800 bg-zinc-900/50"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className={item.done ? "line-through" : "font-medium"}>{item.title}</div>
                  {item.notes && <div className="mt-1 text-sm text-zinc-400">{item.notes}</div>}
                  {item.remindAt && (
                    <div className="mt-1 text-xs text-zinc-500">
                      Reminder: {item.remindAt.toLocaleString()}
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 gap-2">
                  <form action={toggleNotebookItem.bind(null, item.id, !item.done)}>
                    <button className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm hover:bg-zinc-800">
                      {item.done ? "Undo" : "Done"}
                    </button>
                  </form>
                  <form action={deleteNotebookItem.bind(null, item.id)}>
                    <button className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-red-400 hover:bg-zinc-800">
                      Delete
                    </button>
                  </form>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
