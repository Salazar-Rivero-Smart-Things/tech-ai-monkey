#!/usr/bin/env node
/**
 * Tech AI Monkey — Show what the AI has read / studied recently.
 *
 * Usage:
 *   npm run learn:recent
 *   node scripts/study-history.mjs --limit 15
 */

import { existsSync, readFileSync } from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const LOG_PATH = join(ROOT, "skills", "study-log.json");
const NOTES_DIR = join(ROOT, "skills", "study-notes");
const GLOBAL_SKILLS_DIR = join(ROOT, "skills", "global");
const MEMORY_DIR = join(ROOT, ".agent-memory");

function parseLimit() {
  const idx = process.argv.indexOf("--limit");
  if (idx !== -1 && process.argv[idx + 1]) {
    const n = Number(process.argv[idx + 1]);
    if (Number.isFinite(n) && n > 0) return Math.min(50, Math.floor(n));
  }
  return 10;
}

function loadDatabaseUrl() {
  const envPath = join(ROOT, "web", ".env.local");
  if (!existsSync(envPath)) return null;
  const m = readFileSync(envPath, "utf8").match(/^DATABASE_URL=(.+)$/m);
  return m ? m[1].trim().replace(/^["']|["']$/g, "") : null;
}

function fmtDate(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString("no-NO", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function main() {
  const limit = parseLimit();

  console.log("==========================================================");
  console.log("  TECH AI MONKEY — RECENT STUDY & READING HISTORY");
  console.log("==========================================================\n");

  // 1. Study sessions from skills/study-log.json
  let sessions = [];
  let nextTopic = null;
  if (existsSync(LOG_PATH)) {
    try {
      const log = JSON.parse(await readFile(LOG_PATH, "utf8"));
      sessions = Array.isArray(log.sessions) ? log.sessions : [];
      if (Array.isArray(log.curriculum) && log.curriculum.length) {
        nextTopic = log.curriculum[(Number(log.nextIndex) || 0) % log.curriculum.length];
      }
    } catch {
      // ignore malformed log
    }
  }

  console.log(`1) Logged Study Sessions (${sessions.length} total, showing up to ${limit}):`);
  if (sessions.length === 0) {
    console.log("   (No study sessions logged yet — run `npm run learn:next` to start one!)");
  } else {
    for (const [i, s] of sessions.slice(0, limit).entries()) {
      console.log(`   ${i + 1}. [${fmtDate(s.studiedAt)}] ${s.topic} (${s.durationSeconds ?? "?"}s via ${s.engine ?? "agent"})`);
      if (s.summary) console.log(`      Summary: ${s.summary.slice(0, 140)}...`);
      if (s.noteFile) console.log(`      Note   : ${s.noteFile}`);
    }
  }
  if (nextTopic) {
    console.log(`   Next queued topic -> ${nextTopic}`);
  }

  // 2. Study note markdown files
  const noteFiles = existsSync(NOTES_DIR)
    ? (await readdir(NOTES_DIR)).filter((f) => f.endsWith(".md"))
    : [];
  console.log(`\n2) Saved Study Notes in skills/study-notes/: ${noteFiles.length} file(s)`);
  for (const f of noteFiles.slice(-limit).reverse()) {
    const info = await stat(join(NOTES_DIR, f));
    console.log(`   - ${f} (${Math.round(info.size / 1024 * 10) / 10} KB, ${fmtDate(info.mtime.toISOString())})`);
  }

  // 3. Global learned skills
  const globalSkills = existsSync(GLOBAL_SKILLS_DIR)
    ? (await readdir(GLOBAL_SKILLS_DIR)).filter((f) => f.endsWith(".md"))
    : [];
  console.log(`\n3) Global Learned Skills in skills/global/: ${globalSkills.length}`);
  for (const f of globalSkills) {
    const info = await stat(join(GLOBAL_SKILLS_DIR, f));
    console.log(`   - ${f} (updated ${fmtDate(info.mtime.toISOString())})`);
  }

  // 4. Books available / read
  const booksDir = join(ROOT, "books");
  const books = existsSync(booksDir)
    ? (await readdir(booksDir)).filter((f) => !f.startsWith(".") && f.toLowerCase() !== "readme.md")
    : [];
  console.log(`\n4) Books in books/: ${books.length}`);
  for (const b of books.slice(0, 10)) console.log(`   - ${b}`);

  // 5. Long-term memories
  let memoryFiles = [];
  if (existsSync(MEMORY_DIR)) {
    memoryFiles = (await readdir(MEMORY_DIR)).filter((f) => !f.startsWith("."));
  }
  console.log(`\n5) Long-Term Memory Files in .agent-memory/: ${memoryFiles.length}`);

  // 6. PostgreSQL scheduled workflow runs & recent conversations (if DB is online)
  const dbUrl = loadDatabaseUrl();
  if (dbUrl) {
    try {
      const req = createRequire(join(ROOT, "web", "package.json"));
      const postgres = req("postgres");
      const sql = postgres(dbUrl, { connect_timeout: 3, idle_timeout: 2 });
      try {
        const runs = await sql.unsafe(
          `SELECT w.name, r.status, r."startedAt", left(coalesce(r.output, ''), 120) AS preview
           FROM "workflowRun" r
           JOIN workflow w ON w.id = r."workflowId"
           ORDER BY r."startedAt" DESC
           LIMIT $1`,
          [limit],
        );
        console.log(`\n6) Recent Scheduled Workflow Runs (PostgreSQL): ${runs.length}`);
        for (const r of runs) {
          console.log(`   - [${fmtDate(r.startedAt)}] ${r.name} (${r.status})`);
          if (r.preview) console.log(`     ${r.preview.replace(/\s+/g, " ").trim()}...`);
        }

        const convs = await sql.unsafe(
          `SELECT title, "updatedAt" FROM "chatConversation" ORDER BY "updatedAt" DESC LIMIT $1`,
          [limit],
        ).catch(() => []);
        console.log(`\n7) Recent Saved Web Conversations (PostgreSQL): ${convs.length}`);
        for (const c of convs) {
          console.log(`   - [${fmtDate(c.updatedAt)}] ${c.title}`);
        }
      } finally {
        await sql.end();
      }
    } catch {
      console.log("\n6) PostgreSQL: offline (start Tech AI Monkey or Postgres to include DB runs/chats)");
    }
  }

  console.log("\n==========================================================");
}

main().catch((err) => {
  console.error("Failed to read study history:", err.message || err);
  process.exit(1);
});
