#!/usr/bin/env node
// ---------------------------------------------------------------------------
// Hold antall Microsandbox-VM-er nede.
//
// Eve beholder sandkassen etter hver chat (EVE_PERSIST_SANDBOX=1). Uten
// opprydding hoper de seg opp, RAM og swap blir fulle, og «opening sandbox
// session» henger til slutt. Dette skriptet:
//
//   1. fjerner alle krasjede og stoppede eve-sbx-ses-* VM-er
//   2. beholder de N nyeste kjørende VM-ene (standard 3) og fjerner resten
//
// Kjøres fra cron hvert 10. minutt, eller manuelt:
//     node scripts/prune-sandboxes.mjs
//     MAX_RUNNING_SANDBOXES=2 node scripts/prune-sandboxes.mjs
//     DRY_RUN=1 node scripts/prune-sandboxes.mjs
//
// Bare sandkasser som heter eve-sbx-ses-* røres; test-VM-er og annet står.
// ---------------------------------------------------------------------------
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MAX_RUNNING = Number(process.env.MAX_RUNNING_SANDBOXES ?? 3);
const DRY_RUN = process.env.DRY_RUN === "1";

const localCli = join(REPO_DIR, "node_modules", ".bin", "microsandbox");
const CLI = existsSync(localCli) ? localCli : "microsandbox";

function run(args) {
  return execFileSync(CLI, args, { cwd: REPO_DIR, encoding: "utf8", timeout: 120_000 });
}

function listSandboxes() {
  let text;
  try {
    text = run(["list"]);
  } catch (error) {
    console.error(`kunne ikke liste sandkasser: ${error.message}`);
    return [];
  }
  const lines = text.split("\n").filter((line) => line.trim());
  const rows = [];
  for (const line of lines) {
    if (/^NAME\s+IMAGE/.test(line)) continue;
    // NAME  IMAGE  STATUS  CREATED
    const match = line.match(/^(\S+)\s+(\S+)\s+(\S+)\s+(\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2})/);
    if (!match) continue;
    rows.push({
      name: match[1],
      status: match[3],
      createdAt: match[4].replace(" ", "T"),
    });
  }
  return rows;
}

function remove(name) {
  if (DRY_RUN) {
    console.log(`[dry-run] ville fjernet ${name}`);
    return;
  }
  try {
    if (listSandboxes().find((row) => row.name === name)?.status === "running") {
      run(["stop", name]);
    }
  } catch {
    // stop kan feile hvis den allerede er stoppet
  }
  try {
    run(["remove", name]);
    console.log(`fjernet ${name}`);
  } catch (error) {
    console.error(`kunne ikke fjerne ${name}: ${error.message.split("\n")[0]}`);
  }
}

const stamp = new Date().toISOString();
const rows = listSandboxes().filter((row) => row.name.startsWith("eve-sbx-ses-"));
if (rows.length === 0) {
  console.log(`${stamp}  ingen eve-sandkasser`);
  process.exit(0);
}

const dead = rows.filter((row) => row.status !== "running" && row.status !== "draining");
for (const row of dead) remove(row.name);

const running = rows
  .filter((row) => row.status === "running" || row.status === "draining")
  .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

const excess = running.slice(0, Math.max(0, running.length - MAX_RUNNING));
for (const row of excess) remove(row.name);

const kept = running.length - excess.length;
console.log(
  `${stamp}  ${rows.length} sandkasser: fjernet ${dead.length} døde og ${excess.length} gamle, beholdt ${kept} (maks ${MAX_RUNNING})`,
);
