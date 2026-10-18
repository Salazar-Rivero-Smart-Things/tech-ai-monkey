"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { workflows, workflowRuns } from "@/lib/db/schema";
import { runWorkflow } from "@/lib/workflows/runner";

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");
  return session.user;
}

export async function createWorkflow(formData: FormData) {
  const user = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  const prompt = String(formData.get("prompt") ?? "").trim();
  if (!name || !prompt) return;

  const description = String(formData.get("description") ?? "").trim();
  const schedule = String(formData.get("schedule") ?? "manual").trim();
  const scheduleTime = String(formData.get("scheduleTime") ?? "08:00").trim();
  const actionType = String(formData.get("actionType") ?? "email").trim();
  const emailRecipient = String(formData.get("emailRecipient") ?? user.email ?? "").trim();
  const emailSubject = String(formData.get("emailSubject") ?? "").trim();

  await db.insert(workflows).values({
    id: randomUUID(),
    userId: user.id,
    name,
    description: description || null,
    schedule,
    scheduleTime: scheduleTime || null,
    prompt,
    actionType,
    emailRecipient: emailRecipient || null,
    emailSubject: emailSubject || null,
    enabled: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  revalidatePath("/dashboard/workflows");
}

export async function deleteWorkflow(id: string) {
  const user = await requireUser();
  await db
    .delete(workflows)
    .where(and(eq(workflows.id, id), eq(workflows.userId, user.id)));
  revalidatePath("/dashboard/workflows");
}

export async function toggleWorkflow(id: string, enabled: boolean) {
  const user = await requireUser();
  await db
    .update(workflows)
    .set({ enabled, updatedAt: new Date() })
    .where(and(eq(workflows.id, id), eq(workflows.userId, user.id)));
  revalidatePath("/dashboard/workflows");
}

export async function startWorkflowRun(id: string) {
  const user = await requireUser();
  const runId = randomUUID();

  // 1. Create running record immediately
  await db.insert(workflowRuns).values({
    id: runId,
    workflowId: id,
    userId: user.id,
    status: "running",
    startedAt: new Date(),
  });

  await db
    .update(workflows)
    .set({ lastRunAt: new Date(), lastStatus: "running" })
    .where(and(eq(workflows.id, id), eq(workflows.userId, user.id)));

  // 2. Fire and run in background without blocking Server Action HTTP request!
  runWorkflow(id, user.id, runId).catch((err) => {
    console.error("[WorkflowBackgroundRun Error]:", err);
  });

  return { ok: true, runId };
}

export async function getWorkflowRunStatus(runId: string) {
  const user = await requireUser();
  const [run] = await db
    .select()
    .from(workflowRuns)
    .where(and(eq(workflowRuns.id, runId), eq(workflowRuns.userId, user.id)))
    .limit(1);

  if (!run) return null;
  return {
    id: run.id,
    status: run.status,
    output: run.output,
    emailSent: run.emailSent,
    error: run.error,
  };
}

export async function triggerWorkflow(id: string) {
  return startWorkflowRun(id);
}
