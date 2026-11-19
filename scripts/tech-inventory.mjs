#!/usr/bin/env node
/**
 * Tech AI Monkey — Count & list languages, libraries/packages, tools, skills, and models.
 *
 * Usage:
 *   npm run learn:inventory
 *   node scripts/tech-inventory.mjs
 */

import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const EXT_TO_LANG = {
  ".ts": "TypeScript",
  ".tsx": "TypeScript (React/TSX)",
  ".js": "JavaScript",
  ".mjs": "JavaScript (ESM)",
  ".cjs": "JavaScript (CJS)",
  ".jsx": "JavaScript (JSX)",
  ".py": "Python",
  ".sql": "SQL",
  ".sh": "Bash / Shell",
  ".bat": "Windows Batch",
  ".ps1": "PowerShell",
  ".html": "HTML",
  ".css": "CSS",
  ".json": "JSON",
  ".md": "Markdown",
  ".rs": "Rust",
  ".go": "Go",
  ".php": "PHP",
  ".c": "C",
  ".cpp": "C++",
};

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  ".next",
  ".eve",
  ".output",
  "pgdata",
  "pgsql",
  "llama-cpp",
  "models",
  "dist",
  "__pycache__",
]);

function walkFiles(dir, counts = {}) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return counts;
  }
  for (const e of entries) {
    if (SKIP_DIRS.has(e.name)) continue;
    const full = join(dir, e.name);
    if (e.isDirectory()) {
      walkFiles(full, counts);
    } else if (e.isFile()) {
      const lang = EXT_TO_LANG[extname(e.name).toLowerCase()];
      if (lang) counts[lang] = (counts[lang] || 0) + 1;
    }
  }
  return counts;
}

function readPkg(path) {
  if (!existsSync(path)) return { deps: [], devDeps: [] };
  const pkg = JSON.parse(readFileSync(path, "utf8"));
  return {
    deps: Object.entries(pkg.dependencies || {}),
    devDeps: Object.entries(pkg.devDependencies || {}),
  };
}

function countInstalledNodeModules(dir) {
  const nm = join(dir, "node_modules");
  if (!existsSync(nm)) return 0;
  let total = 0;
  for (const e of readdirSync(nm, { withFileTypes: true })) {
    if (e.name.startsWith(".")) continue;
    if (e.name.startsWith("@") && e.isDirectory()) {
      total += readdirSync(join(nm, e.name)).length;
    } else if (e.isDirectory()) {
      total += 1;
    }
  }
  return total;
}

function detectRuntime(cmd, args = ["--version"]) {
  try {
    const out = execFileSync(cmd, args, { encoding: "utf8", timeout: 3000, stdio: ["ignore", "pipe", "pipe"] });
    return out.trim().split(/\r?\n/)[0];
  } catch {
    return null;
  }
}

function listFilesSafe(dir, ext = null) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => !f.startsWith(".") && (!ext || f.endsWith(ext)));
}

function main() {
  const langCounts = walkFiles(ROOT);
  const langEntries = Object.entries(langCounts).sort((a, b) => b[1] - a[1]);

  const rootPkg = readPkg(join(ROOT, "package.json"));
  const webPkg = readPkg(join(ROOT, "web", "package.json"));
  const cliPkg = readPkg(join(ROOT, "cli", "package.json"));

  const allDirect = new Map();
  for (const [name, ver] of [
    ...rootPkg.deps,
    ...rootPkg.devDeps,
    ...webPkg.deps,
    ...webPkg.devDeps,
    ...cliPkg.deps,
    ...cliPkg.devDeps,
  ]) {
    allDirect.set(name, ver);
  }

  const rootNmCount = countInstalledNodeModules(ROOT);
  const webNmCount = countInstalledNodeModules(join(ROOT, "web"));

  const tools = listFilesSafe(join(ROOT, "agent", "tools"), ".ts");
  const builtinSkills = listFilesSafe(join(ROOT, "agent", "skills"), ".md");
  const globalSkills = listFilesSafe(join(ROOT, "skills", "global"), ".md");
  const studyNotes = listFilesSafe(join(ROOT, "skills", "study-notes"), ".md");
  const models = listFilesSafe(join(ROOT, "models"), ".gguf");
  const books = listFilesSafe(join(ROOT, "books")).filter((f) => f.toLowerCase() !== "readme.md");

  const runtimes = [
    ["Node.js", detectRuntime("node", ["-v"])],
    ["npm", detectRuntime("npm.cmd", ["-v"]) || detectRuntime("npm", ["-v"])],
    ["Python", detectRuntime("python", ["--version"])],
    ["Git", detectRuntime("git", ["--version"])],
    ["PostgreSQL (bundled)", existsSync(join(ROOT, "pgsql", "bin", "postgres.exe")) ? detectRuntime(join(ROOT, "pgsql", "bin", "postgres.exe"), ["--version"]) : null],
  ].filter(([, v]) => Boolean(v));

  console.log("==========================================================");
  console.log("  TECH AI MONKEY — LANGUAGES, LIBRARIES & CAPABILITIES");
  console.log("  Supervisors: Gemini & DeepSeek");
  console.log("==========================================================\n");

  console.log(`1) Languages in codebase: ${langEntries.length} distinct language/format types`);
  for (const [lang, count] of langEntries) {
    console.log(`   - ${lang.padEnd(24)} : ${count} file(s)`);
  }

  console.log(`\n2) Installed Local Runtimes: ${runtimes.length}`);
  for (const [name, ver] of runtimes) {
    console.log(`   - ${name.padEnd(24)} : ${ver}`);
  }

  console.log(`\n3) Libraries & Packages:`);
  console.log(`   - Direct packages (unique) : ${allDirect.size}`);
  console.log(`     * Agent (root)           : ${rootPkg.deps.length} deps + ${rootPkg.devDeps.length} devDeps (${rootNmCount} packages in node_modules)`);
  console.log(`     * Web (Next.js)          : ${webPkg.deps.length} deps + ${webPkg.devDeps.length} devDeps (${webNmCount} packages in web/node_modules)`);
  if (cliPkg.deps.length + cliPkg.devDeps.length > 0) {
    console.log(`     * CLI                    : ${cliPkg.deps.length} deps + ${cliPkg.devDeps.length} devDeps`);
  }
  console.log(`   - Total installed packages : ${rootNmCount + webNmCount} (including transitive dependencies)`);
  console.log("\n   Key direct libraries:");
  for (const [name, ver] of [...allDirect.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    console.log(`     • ${name} (${ver})`);
  }

  console.log(`\n4) AI Agent Capabilities:`);
  console.log(`   - Built-in Tools (${tools.length})       : ${tools.map((f) => f.replace(/\.ts$/, "")).join(", ")}`);
  console.log(`   - Built-in Skills (${builtinSkills.length})      : ${builtinSkills.map((f) => f.replace(/\.md$/, "")).join(", ")}`);
  console.log(`   - Global Skills (${globalSkills.length})        : ${globalSkills.map((f) => f.replace(/\.md$/, "")).join(", ")}`);
  console.log(`   - Archived Study Notes     : ${studyNotes.length}`);
  console.log(`   - Local GGUF Models (${models.length})    : ${models.join(", ") || "(none)"}`);
  console.log(`   - Books in library (${books.length})     : ${books.join(", ") || "(none)"}`);
  console.log("\n==========================================================");
}

main();
