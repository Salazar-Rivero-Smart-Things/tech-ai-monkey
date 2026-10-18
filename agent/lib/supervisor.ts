import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { open, readFile, readdir, rm, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

// ---------------------------------------------------------------------------
// In-process supervisor.
//
// Runs inside the agent itself — no cron job, no script the operator has to
// remember. Started once when the module loads, so it is alive for as long as
// the service is:
//
//   1. Removes Microsandbox VMs that crashed or stopped, and keeps at most
//      MAX_RUNNING_SANDBOXES alive (each chat opens one). Without this the
//      machine runs out of RAM and "opening sandbox session" hangs.
//   2. Deletes workflow runs that never finished. If they pile up, the local
//      workflow world re-enqueues them on every restart and new turns queue
//      behind them forever.
//
// Everything is wrapped in try/catch: a supervisor bug must never take the
// agent down. Timeouts come from the environment, so the same code runs in
// production and in tests.
// ---------------------------------------------------------------------------

const INTERVAL_MS = Number(process.env.SUPERVISOR_INTERVAL_MS ?? 60_000) || 60_000;
const MAX_RUNNING_SANDBOXES = Number(process.env.MAX_RUNNING_SANDBOXES ?? 3) || 3;
/** Never touch a VM younger than this: it may belong to an active chat. */
const SANDBOX_MIN_AGE_MINUTES = Number(process.env.SANDBOX_MIN_AGE_MINUTES ?? 20) || 20;
/**
 * Tak som overstyrer aldersgrensen. Uten det kan mange nye chatter på kort tid
 * fylle maskinen med VM-er som alle er «for unge til å røres», og da henger
 * kommandoer i sandkassen fordi verten er tom for minne.
 */
const SANDBOX_HARD_MAX = Number(process.env.SANDBOX_HARD_MAX ?? MAX_RUNNING_SANDBOXES * 2) || MAX_RUNNING_SANDBOXES * 2;
/** A turn with a half-finished step and no activity for this long is dead. */
const ABANDONED_RUN_MINUTES = Number(process.env.ABANDONED_RUN_MINUTES ?? 15) || 15;


function repoRoot(): string {
  const cwd = resolve(process.cwd());
  return existsSync(join(cwd, "agent")) ? cwd : resolve(cwd, "..");
}

async function listSandboxes(root: string): Promise<Array<{ name: string; status: string; createdAt: number }>> {
  const cli = join(root, "node_modules", ".bin", "microsandbox");
  const command = existsSync(cli) ? cli : "microsandbox";
  let text: string;
  try {
    const { stdout } = await execFileAsync(command, ["list"], {
      cwd: root,
      timeout: 60_000,
      maxBuffer: 8 * 1024 * 1024,
    });
    text = stdout;
  } catch {
    return [];
  }

  const rows: Array<{ name: string; status: string; createdAt: number }> = [];
  for (const line of text.split("\n")) {
    if (!line.trim() || /^NAME\s+IMAGE/.test(line)) continue;
    const match = line.match(/^(\S+)\s+(\S+)\s+(\S+)\s+(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})/);
    if (!match) continue;
    const createdAt = Date.parse(`${match[4]}T${match[5]}`);
    rows.push({ name: match[1], status: match[3], createdAt: Number.isFinite(createdAt) ? createdAt : 0 });
  }
  return rows;
}

async function removeSandbox(root: string, name: string): Promise<void> {
  const cli = join(root, "node_modules", ".bin", "microsandbox");
  const command = existsSync(cli) ? cli : "microsandbox";
  await execFileAsync(command, ["stop", name], { cwd: root, timeout: 90_000 }).catch(() => undefined);
  await execFileAsync(command, ["remove", name], { cwd: root, timeout: 90_000 }).catch(() => undefined);
}

async function pruneSandboxes(root: string): Promise<PruneResult> {
  const rows = await listSandboxes(root);
  if (rows.length === 0) return { text: "0 sandkasser", changed: false };

  const now = Date.now();
  const cutoff = now - SANDBOX_MIN_AGE_MINUTES * 60_000;

  const dead = rows.filter((row) => row.status !== "running" && row.status !== "draining");
  for (const row of dead) await removeSandbox(root, row.name);

  const running = rows
    .filter((row) => row.status === "running" || row.status === "draining")
    .sort((a, b) => a.createdAt - b.createdAt);
  const excess = running.slice(0, Math.max(0, running.length - MAX_RUNNING_SANDBOXES));

  // Over hardtaket bryr vi oss ikke om alderen: da er verten i ferd med å gå tom.
  const overHardMax = running.length > SANDBOX_HARD_MAX;
  const removable = overHardMax
    ? running.slice(0, Math.max(0, running.length - MAX_RUNNING_SANDBOXES))
    : excess.filter((row) => row.createdAt > 0 && row.createdAt < cutoff);
  for (const row of removable) await removeSandbox(root, row.name);

  return {
    text: `${rows.length} sandkasser: -${dead.length} døde, -${removable.length} gamle, ${running.length - removable.length} igjen`,
    changed: dead.length + removable.length > 0,
  };
}

async function removeRun(root: string, runId: string): Promise<void> {
  const dataDir = join(root, ".eve", ".workflow-data");
  const dirs = [
    join(dataDir, "runs"),
    join(dataDir, "steps"),
    join(dataDir, "events"),
    join(dataDir, "hooks"),
    join(dataDir, "streams", "runs"),
    join(root, ".eve", "locks", "runs"),
  ];

  for (const dir of dirs) {
    const entries = await readdir(dir).catch(() => [] as string[]);
    for (const entry of entries) {
      if (!entry.includes(runId)) continue;
      await rm(join(dir, entry), { recursive: true, force: true }).catch(() => undefined);
    }
  }
}

type RunRecord = { status?: string; runId?: string; updatedAt?: string; createdAt?: string };
type PruneResult = { text: string; changed: boolean };

type RunAssessment = { stuck: boolean; lastActivity: number };

/** Ser om kjøringen har et steg som startet men aldri ble ferdig. */
async function assessRun(root: string, runId: string, runHeartbeat: number): Promise<RunAssessment> {
  const dataDir = join(root, ".eve", ".workflow-data");
  let lastActivity = runHeartbeat;

  let unfinished = false;
  let steps = 0;
  const stepEntries = await readdir(join(dataDir, "steps")).catch(() => [] as string[]);
  for (const entry of stepEntries) {
    if (!entry.startsWith(`${runId}-`)) continue;
    steps += 1;
    const path = join(dataDir, "steps", entry);
    const info = await stat(path).catch(() => null);
    if (info) lastActivity = Math.max(lastActivity, info.mtimeMs);
    const step = await readFile(path, "utf8")
      .then((raw) => JSON.parse(raw) as { status?: string })
      .catch(() => null);
    if (!step) return { stuck: true, lastActivity };
    if (step.status !== "completed" && step.status !== "failed") unfinished = true;
  }

  const eventEntries = await readdir(join(dataDir, "events")).catch(() => [] as string[]);
  for (const entry of eventEntries) {
    if (!entry.startsWith(`${runId}-`)) continue;
    const info = await stat(join(dataDir, "events", entry)).catch(() => null);
    if (info) lastActivity = Math.max(lastActivity, info.mtimeMs);
  }

  // Ingen steg i det hele tatt: kjøringen startet aldri ordentlig.
  return { stuck: steps === 0 || unfinished, lastActivity };
}

async function pruneRuns(root: string): Promise<PruneResult> {
  const runsDir = join(root, ".eve", ".workflow-data", "runs");
  const files = await readdir(runsDir).catch(() => [] as string[]);
  const cutoff = Date.now() - ABANDONED_RUN_MINUTES * 60_000;
  let removed = 0;

  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    const path = join(runsDir, file);
    let record: RunRecord | null = null;
    try {
      record = JSON.parse(await readFile(path, "utf8")) as RunRecord;
    } catch {
      await rm(path, { force: true }).catch(() => undefined);
      continue;
    }
    if (!record || record.status === "completed" || record.status === "failed") continue;

    const runId = record.runId ?? file.replace(/\.json$/, "");

    // En sesjon som venter på neste melding står også som «running», så
    // tilstanden alene sier ingenting. En tapt tur kjennes på at et steg aldri
    // ble fullført – og at ingenting har skjedd siden.
    const info = await stat(path).catch(() => null);
    const runHeartbeat = Math.max(
      info?.mtimeMs ?? 0,
      Date.parse(record.updatedAt ?? "") || 0,
      Date.parse(record.createdAt ?? "") || 0,
    );
    const { stuck, lastActivity } = await assessRun(root, runId, runHeartbeat);
    if (!stuck) continue;
    if (lastActivity > cutoff) continue; // recent activity: might still be working

    await removeRun(root, runId);
    removed += 1;
  }

  return { text: `${removed} uferdige kjøringer fjernet`, changed: removed > 0 };
}

// eve laster agent-modulen i flere kontekster; hold tilstanden på globalThis så
// prosessen aldri får mer enn én supervisor (og én tick om gangen).
const state = globalThis as typeof globalThis & {
  __techAiSupervisorStarted?: boolean;
  __techAiSupervisorTicking?: boolean;
  __techAiSupervisorTicks?: number;
};

/**
 * Bare én ryddejobb om gangen, også om modulen skulle bli lastet i flere
 * kontekster. Filen er en lease med tidsstempel, så en krasjet rydding aldri
 * blokkerer for godt.
 */
const LOCK_STALE_MS = 10 * 60_000;

async function withLock<T>(root: string, fn: () => Promise<T>): Promise<T | null> {
  const lockPath = join(root, ".eve", "supervisor.lock");

  const acquire = async (): Promise<boolean> => {
    try {
      const handle = await open(lockPath, "wx");
      await handle.writeFile(JSON.stringify({ pid: process.pid, at: Date.now() }));
      await handle.close();
      return true;
    } catch {
      return false;
    }
  };

  if (!(await acquire())) {
    const info = await stat(lockPath).catch(() => null);
    if (info && Date.now() - info.mtimeMs < LOCK_STALE_MS) return null;
    await rm(lockPath, { force: true }).catch(() => undefined);
    if (!(await acquire())) return null;
  }

  try {
    return await fn();
  } finally {
    await rm(lockPath, { force: true }).catch(() => undefined);
  }
}

async function tick(): Promise<void> {
  // Stopping a sandbox can take a minute or two; never let ticks stack up.
  if (state.__techAiSupervisorTicking) return;
  state.__techAiSupervisorTicking = true;
  try {
    const root = repoRoot();
    const report = await withLock(root, async () => {
      const lines: string[] = [];
      let changed = false;
      for (const task of [pruneRuns, pruneSandboxes]) {
        try {
          const result = await task(root);
          lines.push(result.text);
          changed ||= result.changed;
        } catch (error) {
          lines.push(`${task.name} feilet: ${error instanceof Error ? error.message : String(error)}`);
          changed = true;
        }
      }
      return { text: lines.join(" | "), changed };
    });
    if (!report) return; // another instance holds the lease

    state.__techAiSupervisorTicks = (state.__techAiSupervisorTicks ?? 0) + 1;
    // Stille når alt er i orden – men et livstegn hvert 10. minutt.
    if (report.changed || state.__techAiSupervisorTicks % 10 === 1) {
      console.log(`[supervisor] ${report.text}`);
    }
  } finally {
    state.__techAiSupervisorTicking = false;
  }
}

/** Start the supervisor once per process. Safe to call from anywhere. */
export function startSupervisor(): void {
  if (state.__techAiSupervisorStarted || process.env.SUPERVISOR_DISABLED === "1") return;
  state.__techAiSupervisorStarted = true;

  const timer = setInterval(() => {
    void tick().catch((error) => {
      console.error(`[supervisor] uventet feil: ${error instanceof Error ? error.message : String(error)}`);
    });
  }, INTERVAL_MS);

  // Never keep the process alive just for this timer.
  timer.unref?.();
  console.log(
    `[supervisor] aktiv: hvert ${Math.round(INTERVAL_MS / 1000)} s, maks ${MAX_RUNNING_SANDBOXES} VM-er, ` +
      `uferdige kjøringer eldre enn ${ABANDONED_RUN_MINUTES} min ryddes`,
  );
  void tick().catch(() => undefined);
}
