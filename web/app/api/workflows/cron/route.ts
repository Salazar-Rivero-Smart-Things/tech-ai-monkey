import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { workflows } from "@/lib/db/schema";
import { runWorkflow } from "@/lib/workflows/runner";
import { verifyAgentToken } from "@/lib/agent-auth";
import { bearerFrom } from "@/lib/api-caller";

export const dynamic = "force-dynamic";

/**
 * Automated cron trigger endpoint for running due workflows.
 * Can be called by a cron job, systemd timer, or the agent's in-process supervisor.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  let authorized = !cronSecret || authHeader === `Bearer ${cronSecret}`;
  if (!authorized) {
    const bearer = bearerFrom(request);
    const agent = bearer ? await verifyAgentToken(bearer) : null;
    if (agent) authorized = true;
  }

  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const currentHourMinute = `${String(now.getHours()).padStart(2, "0")}:${String(
    now.getMinutes(),
  ).padStart(2, "0")}`;

  // Fetch all active scheduled workflows
  const activeWorkflows = await db
    .select()
    .from(workflows)
    .where(eq(workflows.enabled, true));

  const results = [];

  for (const wf of activeWorkflows) {
    if (wf.schedule === "manual") continue;

    let shouldRun = false;
    const lastRun = wf.lastRunAt ? new Date(wf.lastRunAt).getTime() : 0;
    const timeSinceLastRunHours = (now.getTime() - lastRun) / (1000 * 60 * 60);

    if (wf.schedule === "hourly") {
      // Run if at least 50 minutes passed since last run
      if (timeSinceLastRunHours >= 0.83) {
        shouldRun = true;
      }
    } else if (wf.schedule === "daily") {
      // Run once a day once the configured HH:MM time has been reached
      const targetTime = wf.scheduleTime || "08:00";
      if (timeSinceLastRunHours >= 20 && currentHourMinute >= targetTime) {
        shouldRun = true;
      }
    } else if (wf.schedule === "weekly") {
      // Run once a week
      if (timeSinceLastRunHours >= 160) {
        shouldRun = true;
      }
    }

    if (shouldRun) {
      try {
        const runRes = await runWorkflow(wf.id, wf.userId);
        results.push({ id: wf.id, name: wf.name, status: runRes.status });
      } catch (err: any) {
        results.push({ id: wf.id, name: wf.name, status: "error", error: err.message });
      }
    }
  }

  return NextResponse.json({
    ok: true,
    triggeredCount: results.length,
    results,
    timestamp: now.toISOString(),
  });
}
