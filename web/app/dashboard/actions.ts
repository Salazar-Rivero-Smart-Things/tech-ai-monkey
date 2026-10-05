"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { auth, signOut } from "@/auth";
import { db } from "@/lib/db";
import { deleteUserData } from "@/lib/account";
import { notebooks, integrations, artifacts } from "@/lib/db/schema";

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");
  return session.user.id;
}

// ---- Notebook (reminders until marked done) ----

export async function addNotebookItem(formData: FormData) {
  const userId = await requireUserId();
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;
  const notes = String(formData.get("notes") ?? "").trim();
  const remindRaw = String(formData.get("remindAt") ?? "").trim();

  await db.insert(notebooks).values({
    id: randomUUID(),
    userId,
    title,
    notes: notes || null,
    remindAt: remindRaw ? new Date(remindRaw) : null,
    done: false,
    createdAt: new Date(),
  });
  revalidatePath("/dashboard/notebook");
}

export async function toggleNotebookItem(id: string, done: boolean) {
  const userId = await requireUserId();
  await db
    .update(notebooks)
    .set({ done, doneAt: done ? new Date() : null })
    .where(eq(notebooks.id, id));
  revalidatePath("/dashboard/notebook");
}

export async function deleteNotebookItem(id: string) {
  await requireUserId();
  await db.delete(notebooks).where(eq(notebooks.id, id));
  revalidatePath("/dashboard/notebook");
}

// ---- Integrations (permission dialog) ----

export async function saveIntegrationPermission(formData: FormData) {
  const userId = await requireUserId();
  const provider = String(formData.get("provider") ?? "").trim();
  const permission = String(formData.get("permission") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();
  if (!provider || !permission) return;

  const [existing] = await db
    .select({ id: integrations.id })
    .from(integrations)
    .where(and(eq(integrations.userId, userId), eq(integrations.provider, provider)))
    .limit(1);

  const status = permission === "no" ? "disconnected" : "pending";
  if (existing) {
    await db
      .update(integrations)
      .set({ permission, permissionNote: note || null, status, updatedAt: new Date() })
      .where(eq(integrations.id, existing.id));
  } else {
    await db.insert(integrations).values({
      id: randomUUID(),
      userId,
      provider,
      permission,
      permissionNote: note || null,
      status,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }
  revalidatePath("/dashboard/apps");
}

// ---- Artifacts ----

export async function saveArtifact(kind: string, title: string, content: string) {
  const userId = await requireUserId();
  await db.insert(artifacts).values({
    id: randomUUID(),
    userId,
    kind,
    title,
    content: content || null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  revalidatePath("/dashboard/artifacts");
}

// ---- Privacy & data (GDPR / CASA) ----

/**
 * Permanently deletes the signed-in user and every row we store for them,
 * then signs them out. Irreversible — the UI requires an explicit checkbox.
 */
export async function deleteMyAccount() {
  const userId = await requireUserId();
  await deleteUserData(userId);
  await signOut({ redirectTo: "/" });
}
