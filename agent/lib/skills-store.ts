import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

// ---------------------------------------------------------------------------
// Learned skills — the agent's own, growing library of procedures.
//
// Two kinds of skills exist in this project:
//
//   1. Authored skills   agent/skills/*.md            (shipped with the repo,
//                                                      compiled into the agent)
//   2. Learned skills    skills/global/<slug>.md      (shared with everyone)
//                        skills/users/<id>/<slug>.md  (private to one user)
//
// Learned skills are plain markdown files on disk, so they are visible in the
// repository, editable by hand, and versioned with git. The agent advertises
// each one to the model through a dynamic `load_skill` entry (see
// agent/skills/learned.ts) whose description is the routing hint — the "type
// of question" that should activate the skill.
//
// Storage is file-backed like agent/lib/memory-store.ts. Use EVE_SKILLS_DIR to
// override the location; otherwise the repo root is detected from the cwd so
// both the agent (cwd = repo root) and the web app (cwd = web/) resolve the
// same folder.
// ---------------------------------------------------------------------------

export type SkillScope = "personal" | "global";

export interface LearnedSkill {
  /** URL/file-safe identifier derived from the name. */
  slug: string;
  /** Human-readable title. */
  name: string;
  /** Routing hint: the kind of question this skill should answer. */
  description: string;
  /** Example questions/phrases that should trigger the skill. */
  triggers: string[];
  scope: SkillScope;
  /** Markdown procedure the model loads on demand. */
  body: string;
  /** Principal that created the skill. */
  createdBy: string;
  /** ISO timestamp of the last write. */
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

const MAX_SKILLS = 20000; // hard cap on how many files we ever read in a sweep

/** Walk up from `start` looking for the repo root (has `agent/` and `web/`). */
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

/** The directory that holds every learned skill. */
export function skillsDir(): string {
  const override = process.env.EVE_SKILLS_DIR?.trim();
  if (override) return resolve(override);
  const root = findRepoRoot(process.cwd()) ?? process.cwd();
  return join(root, "skills");
}

/** Where authored, compiled skills live (read-only reference for listing). */
function authoredSkillsDir(): string {
  const root = findRepoRoot(process.cwd()) ?? process.cwd();
  return join(root, "agent", "skills");
}

function globalDir(): string {
  return join(skillsDir(), "global");
}

function usersDir(): string {
  return join(skillsDir(), "users");
}

function personalDir(callerKey: string): string {
  return join(usersDir(), safeKey(callerKey));
}

/** Filesystem-safe scope name: never trust an id from a caller. */
function safeKey(value: string): string {
  return value.replace(/[^a-zA-Z0-9_.-]/g, "_").slice(0, 100) || "local";
}

/** Turn a human name into a stable file slug. */
export function slugify(name: string): string {
  const slug = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents (æ/ø/å → a/o/a)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return slug || "skill";
}

/** The id used to scope personal skills, from verified session auth. */
export function callerKeyFromAuth(
  auth: { subject?: string; principalId?: string } | null | undefined,
): string {
  return auth?.subject ?? auth?.principalId ?? "local";
}

/** True for the instance owner, who may publish skills for everybody. */
export function isOwnerRole(role: string | undefined): boolean {
  const value = (role ?? "").toLowerCase();
  return value === "admin" || value === "owner";
}

// ---------------------------------------------------------------------------
// Tiny frontmatter reader/writer. Deliberately not a YAML parser: the shape is
// fixed and must round-trip byte-for-byte for hand-edited files.
// ---------------------------------------------------------------------------

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

function serializeFrontmatter(skill: LearnedSkill): string {
  const clean = (value: string) => value.replace(/\r?\n/g, " ").trim();
  const lines = [
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
  ];
  return lines.join("\n");
}

function toSkill(
  raw: string,
  slug: string,
  scope: SkillScope,
  fallbackAuthor: string,
): LearnedSkill | null {
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

async function readSkillFile(
  path: string,
  slug: string,
  scope: SkillScope,
  fallbackAuthor: string,
): Promise<LearnedSkill | null> {
  try {
    const raw = await readFile(path, "utf-8");
    return toSkill(raw, slug, scope, fallbackAuthor);
  } catch {
    return null;
  }
}

async function listDirSkillFiles(dir: string): Promise<string[]> {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
      .map((entry) => entry.name.replace(/\.md$/, ""))
      .slice(0, MAX_SKILLS);
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function listGlobalSkills(): Promise<LearnedSkill[]> {
  const dir = globalDir();
  const slugs = await listDirSkillFiles(dir);
  const skills = await Promise.all(
    slugs.map((slug) => readSkillFile(join(dir, `${slug}.md`), slug, "global", "owner")),
  );
  return skills.filter((skill): skill is LearnedSkill => skill !== null);
}

export async function listPersonalSkills(callerKey: string): Promise<LearnedSkill[]> {
  const dir = personalDir(callerKey);
  const slugs = await listDirSkillFiles(dir);
  const skills = await Promise.all(
    slugs.map((slug) => readSkillFile(join(dir, `${slug}.md`), slug, "personal", callerKey)),
  );
  return skills.filter((skill): skill is LearnedSkill => skill !== null);
}

/**
 * Every learned skill visible to one caller: shared ones plus their own.
 * A personal skill with the same slug as a global one wins, so a user can
 * override a shared procedure for themselves.
 */
export async function listLearnedSkills(callerKey: string): Promise<LearnedSkill[]> {
  const [global, personal] = await Promise.all([
    listGlobalSkills(),
    listPersonalSkills(callerKey),
  ]);
  const bySlug = new Map<string, LearnedSkill>();
  for (const skill of global) bySlug.set(skill.slug, skill);
  for (const skill of personal) bySlug.set(skill.slug, skill);
  return [...bySlug.values()].sort((a, b) => a.slug.localeCompare(b.slug));
}

export async function getLearnedSkill(
  scope: SkillScope,
  callerKey: string,
  slug: string,
): Promise<LearnedSkill | null> {
  const dir = scope === "global" ? globalDir() : personalDir(callerKey);
  return readSkillFile(join(dir, `${slugify(slug)}.md`), slugify(slug), scope, callerKey);
}

export async function saveLearnedSkill(input: {
  name: string;
  description: string;
  body: string;
  triggers?: string[];
  scope: SkillScope;
  createdBy: string;
  slug?: string;
}): Promise<LearnedSkill> {
  const slug = slugify(input.slug || input.name);
  const skill: LearnedSkill = {
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
  await writeFile(join(dir, `${slug}.md`), serializeFrontmatter(skill), "utf-8");
  return skill;
}

export async function removeLearnedSkill(
  scope: SkillScope,
  callerKey: string,
  slug: string,
): Promise<boolean> {
  const dir = scope === "global" ? globalDir() : personalDir(callerKey);
  const path = join(dir, `${slugify(slug)}.md`);
  if (!existsSync(path)) return false;
  await rm(path, { force: true });
  return true;
}

export async function moveLearnedSkill(
  from: SkillScope,
  callerKey: string,
  slug: string,
  to: SkillScope,
  author: string,
): Promise<LearnedSkill | null> {
  const existing = await getLearnedSkill(from, callerKey, slug);
  if (!existing) return null;
  const saved = await saveLearnedSkill({
    slug: existing.slug,
    name: existing.name,
    description: existing.description,
    body: existing.body,
    triggers: existing.triggers,
    scope: to,
    createdBy: to === "global" ? existing.createdBy || author : author,
  });
  await removeLearnedSkill(from, callerKey, slug);
  return saved;
}

/** Authored, compiled skills — listed read-only for the dashboard. */
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
        const raw = await readFile(join(dir, file), "utf-8");
        const { fields, body } = parseFrontmatter(raw);
        const slug = file.replace(/\.md$/, "");
        const firstLine = body
          .split(/\r?\n/)
          .map((line) => line.trim())
          .find((line) => line && !line.startsWith("#") && !line.startsWith("```"));
        const description = fields.description?.trim() || firstLine || "";
        return { slug, name: slug, description, triggers: [], scope: "builtin" };
      } catch {
        return null;
      }
    }),
  );
  return skills.filter((skill): skill is SkillSummary => skill !== null);
}

/** Advertised description: the routing hint plus example trigger phrases. */
export function advertisedDescription(skill: LearnedSkill): string {
  const examples = skill.triggers.length > 0 ? ` Examples: ${skill.triggers.join("; ")}.` : "";
  return `${skill.description}${examples}`.slice(0, 1024);
}

export function summarize(skill: LearnedSkill): SkillSummary {
  return {
    slug: skill.slug,
    name: skill.name,
    description: skill.description,
    triggers: skill.triggers,
    scope: skill.scope,
    updatedAt: skill.updatedAt,
  };
}

export { findRepoRoot };
export const paths = { skillsDir, globalDir, usersDir, personalDir, authoredSkillsDir };
