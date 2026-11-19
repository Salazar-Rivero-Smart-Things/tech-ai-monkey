import crypto from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { workflows } from "@/lib/db/schema";

export const DAILY_LEARNING_WORKFLOW_NAME = "Daily Tech & Software Engineering Study (1h)";

const DEFAULT_PROMPT = [
  "Run your daily 1-hour software engineering & tech radar study session (supervised by Gemini & DeepSeek).",
  "Follow the global skill 'Daily Tech & Software Engineering Learning':",
  "1. Search and read the latest developer news, framework releases (TypeScript, Next.js, React, Python, PostgreSQL, llama.cpp, AI tooling), and top tech magazines (Hacker News, InfoQ, Ars Technica, TechCrunch).",
  "2. Distill the most actionable engineering insights, new libraries, breaking changes, and security alerts.",
  "3. Save genuinely reusable patterns with learn_skill and durable version facts with remember.",
  "4. Deliver a crisp daily digest with source links.",
].join("\n");

function readScheduleFile(): { time: string; durationMinutes: number; enabled: boolean } {
  const candidates = [
    join(resolve(process.cwd(), ".."), "skills", "study-schedule.json"),
    join(resolve(process.cwd()), "skills", "study-schedule.json"),
  ];
  for (const path of candidates) {
    if (!existsSync(path)) continue;
    try {
      const parsed = JSON.parse(readFileSync(path, "utf8")) as {
        time?: string;
        durationMinutes?: number;
        enabled?: boolean;
      };
      return {
        time: typeof parsed.time === "string" && /^\d{2}:\d{2}$/.test(parsed.time) ? parsed.time : "06:00",
        durationMinutes:
          typeof parsed.durationMinutes === "number" && Number.isFinite(parsed.durationMinutes)
            ? parsed.durationMinutes
            : 60,
        enabled: parsed.enabled !== false,
      };
    } catch {
      // fall through
    }
  }
  return { time: "06:00", durationMinutes: 60, enabled: true };
}

/**
 * Ensures the owner/user has the Daily Tech & Software Engineering Study workflow
 * registered in PostgreSQL (synced from skills/study-schedule.json on first visit).
 */
export async function ensureDailyLearningWorkflow(userId: string): Promise<void> {
  const existing = await db
    .select({ id: workflows.id })
    .from(workflows)
    .where(and(eq(workflows.userId, userId), eq(workflows.name, DAILY_LEARNING_WORKFLOW_NAME)))
    .limit(1);

  if (existing.length > 0) return;

  const cfg = readScheduleFile();
  await db.insert(workflows).values({
    id: crypto.randomUUID(),
    userId,
    name: DAILY_LEARNING_WORKFLOW_NAME,
    description: `Daily ${cfg.durationMinutes}-minute software engineering & tech news study session (Supervised by Gemini & DeepSeek).`,
    schedule: "daily",
    scheduleTime: cfg.time,
    prompt: DEFAULT_PROMPT,
    actionType: "artifact",
    enabled: cfg.enabled,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}
