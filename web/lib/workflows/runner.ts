import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { workflows, workflowRuns, artifacts, users } from "@/lib/db/schema";
import { createAgentToken } from "@/lib/agent-auth";
import { sendWorkflowEmail } from "@/lib/email";

export interface WorkflowRunResult {
  runId: string;
  status: "success" | "failed";
  output: string;
  emailSent: boolean;
  emailNote?: string;
  error?: string;
}

/**
 * Execute an AI prompt by creating a session on the Eve agent and collecting the response.
 */
async function executeAgentPrompt(userId: string, prompt: string): Promise<string> {
  const agentUrl = process.env.EVE_AGENT_URL || "http://127.0.0.1:2000";
  let token = "";
  try {
    token = await createAgentToken(userId, { role: "user" });
  } catch (err: any) {
    console.warn("[WorkflowRunner] createAgentToken failed, trying unauthenticated:", err.message);
  }

  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (token) {
    headers["authorization"] = `Bearer ${token}`;
  }

  // 1. Create session and start turn
  const createRes = await fetch(`${agentUrl}/eve/v1/session`, {
    method: "POST",
    headers,
    body: JSON.stringify({ message: prompt }),
  });

  if (!createRes.ok) {
    const errText = await createRes.text().catch(() => "");
    throw new Error(`Agent session error (${createRes.status}): ${errText || createRes.statusText}`);
  }

  const sessionData = (await createRes.json()) as { sessionId?: string };
  if (!sessionData.sessionId) {
    throw new Error("Did not receive a sessionId from the agent.");
  }

  const sessionId = sessionData.sessionId;

  // 2. Stream and collect output
  const streamRes = await fetch(`${agentUrl}/eve/v1/session/${sessionId}/stream`, {
    headers,
  });

  if (!streamRes.ok || !streamRes.body) {
    throw new Error(`Agent stream error: ${streamRes.statusText}`);
  }

  const reader = streamRes.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let fullOutput = "";
  let done = false;

  while (!done) {
    const { done: streamDone, value } = await reader.read();
    if (streamDone) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const ev = JSON.parse(line);
        if (ev.type === "message.appended") {
          fullOutput += ev.data?.messageDelta ?? "";
        } else if (ev.type === "message.completed") {
          if (typeof ev.data?.message === "string" && ev.data.message) {
            fullOutput = ev.data.message;
          }
        } else if (ev.type === "turn.failed" || ev.type === "session.failed") {
          throw new Error(ev.data?.message || "Agent turn failed.");
        } else if (
          ev.type === "turn.completed" ||
          ev.type === "session.completed" ||
          ev.type === "session.waiting"
        ) {
          done = true;
          break;
        }
      } catch (e: any) {
        if (e.message?.includes("Agent turn failed")) throw e;
        // ignore non-json line parses
      }
    }
  }

  return fullOutput.trim() || "Rutinen ble fullført uten tekstlig utdata.";
}

/**
 * Execute a workflow by ID, generating AI output and performing associated actions (email, artifact).
 */
export async function runWorkflow(
  workflowId: string,
  userId: string,
  existingRunId?: string,
): Promise<WorkflowRunResult> {
  // 1. Fetch workflow
  const [wf] = await db
    .select()
    .from(workflows)
    .where(eq(workflows.id, workflowId))
    .limit(1);

  if (!wf) {
    throw new Error(`Workflow with ID ${workflowId} not found.`);
  }

  const runId = existingRunId || randomUUID();

  // 2. Create running record if not already created
  if (!existingRunId) {
    await db.insert(workflowRuns).values({
      id: runId,
      workflowId: wf.id,
      userId,
      status: "running",
      startedAt: new Date(),
    });

    // Update workflow status
    await db
      .update(workflows)
      .set({ lastRunAt: new Date(), lastStatus: "running" })
      .where(eq(workflows.id, wf.id));
  }

  let output = "";
  let emailSent = false;
  let emailNote = "";
  let runStatus: "success" | "failed" = "success";
  let errorMessage: string | undefined = undefined;

  try {
    // 3. Execute prompt via AI agent
    output = await executeAgentPrompt(userId, wf.prompt);

    // 4. Handle Email Action
    if ((wf.actionType === "email" || wf.actionType === "both") && wf.emailRecipient) {
      const emailRes = await sendWorkflowEmail({
        to: wf.emailRecipient,
        subject: wf.emailSubject || `[Tech AI] ${wf.name}`,
        body: output,
        workflowName: wf.name,
      });

      emailSent = emailRes.success;
      if (emailRes.note) {
        emailNote = emailRes.note;
      }
      if (!emailRes.success && emailRes.error) {
        errorMessage = `E-post feil: ${emailRes.error}`;
      }
    }

    // 5. Handle Artifact Action
    if (wf.actionType === "artifact" || wf.actionType === "both") {
      await db.insert(artifacts).values({
        id: randomUUID(),
        userId,
        title: `${wf.name} (${new Date().toLocaleDateString("no-NO")})`,
        kind: "workflow",
        content: output,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    // 6. Complete Run successfully
    await db
      .update(workflowRuns)
      .set({
        status: "success",
        output,
        emailSent,
        error: errorMessage || null,
        completedAt: new Date(),
      })
      .where(eq(workflowRuns.id, runId));

    await db
      .update(workflows)
      .set({
        lastRunAt: new Date(),
        lastStatus: "success",
        updatedAt: new Date(),
      })
      .where(eq(workflows.id, wf.id));

    return {
      runId,
      status: "success",
      output,
      emailSent,
      emailNote,
    };
  } catch (err: any) {
    console.error("[WorkflowRunner Error]:", err);
    runStatus = "failed";
    errorMessage = err.message || "Ukjent feil under kjøring av rutinen.";

    await db
      .update(workflowRuns)
      .set({
        status: "failed",
        output: output || null,
        error: errorMessage,
        completedAt: new Date(),
      })
      .where(eq(workflowRuns.id, runId));

    await db
      .update(workflows)
      .set({
        lastRunAt: new Date(),
        lastStatus: "failed",
        updatedAt: new Date(),
      })
      .where(eq(workflows.id, wf.id));

    return {
      runId,
      status: "failed",
      output,
      emailSent: false,
      error: errorMessage,
    };
  }
}
