"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isUnlimited } from "@/lib/entitlements";
import { deleteSkill, moveSkill, saveSkill, type SkillScope } from "@/lib/skills-store";

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");
  return {
    id: session.user.id,
    email: session.user.email,
    role: session.user.role,
    canPublish: isUnlimited({
      id: session.user.id,
      email: session.user.email,
      role: session.user.role,
    }),
  };
}

function refresh() {
  revalidatePath("/dashboard/skills");
}

function parseTriggers(value: string): string[] {
  return value
    .split(",")
    .map((trigger) => trigger.trim())
    .filter(Boolean)
    .slice(0, 12);
}

/** Create or overwrite a skill. Global is only honoured for the owner. */
export async function createSkill(formData: FormData) {
  const user = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const body = String(formData.get("procedure") ?? "").trim();
  const triggers = parseTriggers(String(formData.get("triggers") ?? ""));
  const requested: SkillScope =
    String(formData.get("scope") ?? "personal") === "global" ? "global" : "personal";

  if (!name || !description || !body) return;

  const scope: SkillScope = requested === "global" && user.canPublish ? "global" : "personal";
  await saveSkill({
    name,
    description,
    body,
    triggers,
    scope,
    createdBy: user.id,
  });
  refresh();
}

/** Delete one of the caller's skills (or a global one, if they are the owner). */
export async function removeSkill(scope: SkillScope, slug: string) {
  const user = await requireUser();
  if (scope === "global" && !user.canPublish) return;
  await deleteSkill(scope, user.id, slug);
  refresh();
}

/** Publish a personal skill to everyone, or make a global one private again. */
export async function setSkillScope(slug: string, to: SkillScope) {
  const user = await requireUser();
  if (to === "global" && !user.canPublish) return;

  const from: SkillScope = to === "global" ? "personal" : "global";
  await moveSkill(from, user.id, slug, to);
  refresh();
}
