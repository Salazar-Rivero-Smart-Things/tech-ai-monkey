import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

// ---------------------------------------------------------------------------
// Learned skills — server-side store for the dashboard.
//
// This mirrors agent/lib/skills-store.ts so the dashboard can list, create,
// publish and delete exactly the same files the agent reads at runtime:
//
//   skills/global/<slug>.md      shared with every user
//   skills/users/<userId>/<slug>.md   private to one user
//
// Keep the on-disk format (frontmatter keys) in sync with the agent store.
// ---------------------------------------------------------------------------

export type SkillScope = "personal" | "global";

export interface StoredSkill {
  slug: string;
  name: string;
  description: string;
  triggers: string[];
  scope: SkillScope;
  body: string;
  createdBy: string;
  updatedAt: string;
}

export interface SkillSummary {
  slug: string;
  name: string;
  description: string;
  triggers: string[];
  scope: SkillScope | "builtin";
  updatedAt?: string;
}

const MAX_SKILLS = 20000;

function findRepoRoot(start: string): string | null {
  let dir = resolve(start);
  for (let i = 0; i < 6; i += 1) {
    if (existsSync(join(dir, "agent")) && existsSync(join(dir, "web"))) return dir;
    const parent = resolve(dir, "..");
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

export function skillsDir(): string {
  const override = process.env.EVE_SKILLS_DIR?.trim();
  if (override) return resolve(override);
  const root = findRepoRoot(process.cwd()) ?? resolve(process.cwd(), "..");
  return join(root, "skills");
}

function authoredSkillsDir(): string {
  const root = findRepoRoot(process.cwd()) ?? resolve(process.cwd(), "..");
  return join(root, "agent", "skills");
}

function globalDir(): string {
  return join(skillsDir(), "global");
}

function personalDir(userId: string): string {
  return join(skillsDir(), "users", safeKey(userId));
}

function safeKey(value: string): string {
  return value.replace(/[^a-zA-Z0-9_.-]/g, "_").slice(0, 100) || "local";
}

export function slugify(name: string): string {
  const slug = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return slug || "skill";
}

interface Frontmatter {
  fields: Record<string, string>;
  body: string;
}

function parseFrontmatter(raw: string): Frontmatter {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(raw);
  if (!match) return { fields: {}, body: raw.trim() };

  const fields: Record<string, string> = {};
  for (const line of match[1].split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const sep = trimmed.indexOf(":");
    if (sep === -1) continue;
    const key = trimmed.slice(0, sep).trim();
    const value = trimmed.slice(sep + 1).trim();
    if (key) fields[key] = value;
  }
  return { fields, body: raw.slice(match[0].length).trim() };
}

function serialize(skill: StoredSkill): string {
  const clean = (value: string) => value.replace(/\r?\n/g, " ").trim();
  return [
    "---",
    `name: ${clean(skill.name)}`,
    `description: ${clean(skill.description)}`,
    `triggers: ${skill.triggers.map(clean).filter(Boolean).join(", ")}`,
    `scope: ${skill.scope}`,
    `createdBy: ${clean(skill.createdBy)}`,
    `updatedAt: ${skill.updatedAt}`,
    "---",
    "",
    skill.body.trim(),
    "",
  ].join("\n");
}

function toSkill(
  raw: string,
  slug: string,
  scope: SkillScope,
  fallbackAuthor: string,
): StoredSkill | null {
  const { fields, body } = parseFrontmatter(raw);
  const description = fields.description?.trim();
  if (!description || !body) return null;
  return {
    slug,
    name: fields.name?.trim() || slug,
    description,
    triggers: (fields.triggers ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
    scope,
    body,
    createdBy: fields.createdBy?.trim() || fallbackAuthor,
    updatedAt: fields.updatedAt?.trim() || "",
  };
}

async function readSkill(
  dir: string,
  slug: string,
  scope: SkillScope,
  fallbackAuthor: string,
): Promise<StoredSkill | null> {
  try {
    return toSkill(await readFile(join(dir, `${slug}.md`), "utf-8"), slug, scope, fallbackAuthor);
  } catch {
    return null;
  }
}

async function listSlugs(dir: string): Promise<string[]> {
  try {
    return (await readdir(dir, { withFileTypes: true }))
      .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
      .map((entry) => entry.name.replace(/\.md$/, ""))
      .slice(0, MAX_SKILLS);
  } catch {
    return [];
  }
}

export async function listGlobalSkills(): Promise<StoredSkill[]> {
  const dir = globalDir();
  const skills = await Promise.all(
    (await listSlugs(dir)).map((slug) => readSkill(dir, slug, "global", "owner")),
  );
  return skills.filter((skill): skill is StoredSkill => skill !== null);
}

export async function listPersonalSkills(userId: string): Promise<StoredSkill[]> {
  const dir = personalDir(userId);
  const skills = await Promise.all(
    (await listSlugs(dir)).map((slug) => readSkill(dir, slug, "personal", userId)),
  );
  return skills.filter((skill): skill is StoredSkill => skill !== null);
}

export async function getStoredSkill(
  scope: SkillScope,
  userId: string,
  slug: string,
): Promise<StoredSkill | null> {
  const dir = scope === "global" ? globalDir() : personalDir(userId);
  return readSkill(dir, slugify(slug), scope, userId);
}

export async function saveSkill(input: {
  name: string;
  description: string;
  body: string;
  triggers?: string[];
  scope: SkillScope;
  createdBy: string;
  slug?: string;
}): Promise<StoredSkill> {
  const slug = slugify(input.slug || input.name);
  const skill: StoredSkill = {
    slug,
    name: input.name.trim(),
    description: input.description.trim(),
    triggers: (input.triggers ?? []).map((value) => value.trim()).filter(Boolean).slice(0, 20),
    scope: input.scope,
    body: input.body.trim(),
    createdBy: input.createdBy,
    updatedAt: new Date().toISOString(),
  };
  const dir = input.scope === "global" ? globalDir() : personalDir(input.createdBy);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, `${slug}.md`), serialize(skill), "utf-8");
  return skill;
}

export async function deleteSkill(
  scope: SkillScope,
  userId: string,
  slug: string,
): Promise<boolean> {
  const dir = scope === "global" ? globalDir() : personalDir(userId);
  const path = join(dir, `${slugify(slug)}.md`);
  if (!existsSync(path)) return false;
  await rm(path, { force: true });
  return true;
}

export async function moveSkill(
  from: SkillScope,
  userId: string,
  slug: string,
  to: SkillScope,
): Promise<StoredSkill | null> {
  const existing = await getStoredSkill(from, userId, slug);
  if (!existing) return null;
  const saved = await saveSkill({
    slug: existing.slug,
    name: existing.name,
    description: existing.description,
    body: existing.body,
    triggers: existing.triggers,
    scope: to,
    createdBy: to === "global" ? existing.createdBy || userId : userId,
  });
  await deleteSkill(from, userId, slug);
  return saved;
}

export async function listBuiltinSkills(): Promise<SkillSummary[]> {
  const dir = authoredSkillsDir();
  let entries: string[];
  try {
    entries = (await readdir(dir, { withFileTypes: true }))
      .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
      .map((entry) => entry.name);
  } catch {
    return [];
  }

  const skills = await Promise.all(
    entries.map(async (file): Promise<SkillSummary | null> => {
      try {
        const { fields, body } = parseFrontmatter(await readFile(join(dir, file), "utf-8"));
        const slug = file.replace(/\.md$/, "");
        const firstLine = body
          .split(/\r?\n/)
          .map((line) => line.trim())
          .find((line) => line && !line.startsWith("#") && !line.startsWith("```"));
        return {
          slug,
          name: slug,
          description: fields.description?.trim() || firstLine || "",
          triggers: [],
          scope: "builtin",
        };
      } catch {
        return null;
      }
    }),
  );
  return skills.filter((skill): skill is SkillSummary => skill !== null);
}

export function summarize(skill: StoredSkill): SkillSummary {
  return {
    slug: skill.slug,
    name: skill.name,
    description: skill.description,
    triggers: skill.triggers,
    scope: skill.scope,
    updatedAt: skill.updatedAt,
  };
}
