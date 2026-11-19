#!/usr/bin/env node
/**
 * Tech AI Monkey — View or configure the daily 1-hour reading / study schedule.
 * Syncs both skills/study-schedule.json AND the PostgreSQL `workflow` table
 * (so it is also visible & editable under Dashboard -> Workflows locally and on tech-ai.tech).
 *
 * Usage:
 *   npm run learn:schedule
 *   npm run learn:schedule -- --time 06:00 --duration 60 --enable
 *   npm run learn:schedule -- --time 22:30 --duration 60
 *   npm run learn:schedule -- --disable
 */

import crypto from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const SCHEDULE_PATH = join(ROOT, "skills", "study-schedule.json");
const WORKFLOW_NAME = "Daily Tech & Software Engineering Study (1h)";

const DEFAULT_PROMPT = [
  "Run your daily 1-hour software engineering & tech radar study session (supervised by Gemini & DeepSeek).",
  "Follow the global skill 'Daily Tech & Software Engineering Learning':",
  "1. Search and read the latest developer news, framework releases (TypeScript, Next.js, React, Python, PostgreSQL, llama.cpp, AI tooling), and top tech magazines (Hacker News, InfoQ, Ars Technica, TechCrunch).",
  "2. Distill the most actionable engineering insights, new libraries, breaking changes, and security alerts.",
  "3. Save genuinely reusable patterns with learn_skill and durable version facts with remember.",
  "4. Deliver a crisp daily digest with source links.",
].join("\n");

function parseArgs(argv) {
  const opts = { showOnly: true };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--time" && argv[i + 1]) {
      opts.time = argv[++i];
      opts.showOnly = false;
    } else if (a === "--duration" && argv[i + 1]) {
      opts.durationMinutes = Number(argv[++i]);
      opts.showOnly = false;
    } else if (a === "--enable") {
      opts.enabled = true;
      opts.showOnly = false;
    } else if (a === "--disable") {
      opts.enabled = false;
      opts.showOnly = false;
    } else if (a === "--show") {
      // keep default
    }
  }
  return opts;
}

function loadDatabaseUrl() {
  const envPath = join(ROOT, "web", ".env.local");
  if (!existsSync(envPath)) return null;
  const m = readFileSync(envPath, "utf8").match(/^DATABASE_URL=(.+)$/m);
  return m ? m[1].trim().replace(/^["']|["']$/g, "") : null;
}

async function readSchedule() {
  try {
    return JSON.parse(await readFile(SCHEDULE_PATH, "utf8"));
  } catch {
    return {
      name: WORKFLOW_NAME,
      enabled: true,
      frequency: "daily",
      time: "06:00",
      durationMinutes: 60,
      supervisors: ["Gemini", "DeepSeek"],
      updatedAt: new Date().toISOString(),
    };
  }
}

function nextRunDescription(timeStr) {
  const [hh, mm] = timeStr.split(":").map(Number);
  const now = new Date();
  const next = new Date(now);
  next.setHours(hh, mm, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  return next.toLocaleString("no-NO", {
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function syncToPostgres(schedule) {
  const dbUrl = loadDatabaseUrl();
  if (!dbUrl) return { synced: false, note: "DATABASE_URL not found in web/.env.local" };

  try {
    const req = createRequire(join(ROOT, "web", "package.json"));
    const postgres = req("postgres");
    const sql = postgres(dbUrl, { connect_timeout: 4, idle_timeout: 2 });
    try {
      const owners = await sql.unsafe(
        `SELECT id, email FROM "user" ORDER BY CASE WHEN role = 'admin' THEN 0 ELSE 1 END, "createdAt" ASC LIMIT 1`,
      );
      if (owners.length === 0) {
        return { synced: false, note: "No users in database yet" };
      }
      const owner = owners[0];
      const existing = await sql.unsafe(
        `SELECT id FROM workflow WHERE "userId" = $1 AND name = $2 LIMIT 1`,
        [owner.id, WORKFLOW_NAME],
      );
      const description = `Daily ${schedule.durationMinutes}-minute software engineering & tech news study session (Supervised by ${schedule.supervisors.join(" & ")}).`;

      if (existing.length > 0) {
        await sql.unsafe(
          `UPDATE workflow
           SET description = $1, schedule = 'daily', "scheduleTime" = $2, enabled = $3, "updatedAt" = NOW()
           WHERE id = $4`,
          [description, schedule.time, schedule.enabled, existing[0].id],
        );
        return { synced: true, note: `Updated Dashboard Workflow for ${owner.email} (id: ${existing[0].id})` };
      }

      const id = crypto.randomUUID();
      await sql.unsafe(
        `INSERT INTO workflow (id, "userId", name, description, schedule, "scheduleTime", prompt, "actionType", enabled, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, 'daily', $5, $6, 'artifact', $7, NOW(), NOW())`,
        [id, owner.id, WORKFLOW_NAME, description, schedule.time, DEFAULT_PROMPT, schedule.enabled],
      );
      return { synced: true, note: `Created Dashboard Workflow for ${owner.email} (id: ${id})` };
    } finally {
      await sql.end();
    }
  } catch (err) {
    return { synced: false, note: `PostgreSQL offline (${err.code || err.message}) — saved to skills/study-schedule.json` };
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const current = await readSchedule();

  if (opts.time !== undefined) {
    if (!/^\d{2}:\d{2}$/.test(opts.time)) {
      console.error("Invalid --time format. Use HH:MM (24-hour), e.g. --time 06:00 or --time 22:30");
      process.exit(1);
    }
    const [h, m] = opts.time.split(":").map(Number);
    if (h > 23 || m > 59) {
      console.error("Invalid --time value. Hours must be 00-23 and minutes 00-59.");
      process.exit(1);
    }
    current.time = opts.time;
  }

  if (opts.durationMinutes !== undefined) {
    if (!Number.isFinite(opts.durationMinutes) || opts.durationMinutes < 5 || opts.durationMinutes > 240) {
      console.error("Invalid --duration value. Use minutes between 5 and 240 (e.g. --duration 60).");
      process.exit(1);
    }
    current.durationMinutes = Math.round(opts.durationMinutes);
  }

  if (opts.enabled !== undefined) {
    current.enabled = opts.enabled;
  }

  current.supervisors = ["Gemini", "DeepSeek"];
  current.updatedAt = new Date().toISOString();

  await mkdir(dirname(SCHEDULE_PATH), { recursive: true });
  await writeFile(SCHEDULE_PATH, JSON.stringify(current, null, 2) + "\n", "utf8");

  const dbSync = await syncToPostgres(current);

  console.log("==========================================================");
  console.log("  TECH AI MONKEY — DAILY READING / STUDY SCHEDULE");
  console.log("==========================================================");
  console.log(`Workflow       : ${current.name}`);
  console.log(`Status         : ${current.enabled ? "ENABLED (active)" : "DISABLED (paused)"}`);
  console.log(`Frequency      : ${current.frequency} at ${current.time}`);
  console.log(`Study Duration : ${current.durationMinutes} minutes`);
  console.log(`Next Run       : ${current.enabled ? nextRunDescription(current.time) : "Paused"}`);
  console.log(`Supervisors    : ${current.supervisors.join(" & ")}`);
  console.log(`Config File    : skills/study-schedule.json`);
  console.log(`Database Sync  : ${dbSync.synced ? "OK — " : "Pending — "}${dbSync.note}`);
  console.log("==========================================================");
}

main().catch((err) => {
  console.error("Failed to manage study schedule:", err.message || err);
  process.exit(1);
});
