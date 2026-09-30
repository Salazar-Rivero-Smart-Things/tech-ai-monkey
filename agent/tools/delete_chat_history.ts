import { defineTool } from "eve/tools";
import { z } from "zod";
import { signAgentToken } from "../lib/jwt";

const selfUrl = () => process.env.EVE_PUBLIC_URL ?? "http://127.0.0.1:2000";

export default defineTool({
  description:
    "Delete chat history. Use 'clear' to erase the current conversation while keeping the session, or 'reset' to retire/delete a whole session. Used when the user asks to delete or clear history.",
  inputSchema: z.object({
    action: z
      .enum(["clear", "reset"])
      .describe("clear = delete conversation history; reset = delete the whole session."),
    sessionId: z
      .string()
      .optional()
      .describe("Session ID to act on. Omit to act on the current session."),
  }),
  async execute({ action, sessionId }, ctx) {
    const current = ctx.session.id;
    const target = sessionId ?? current;

    // Clearing or resetting the session you are currently answering in would
    // wait for this very turn to settle (deadlock), so it must happen outside
    // the turn: from the web UI buttons or the HTTP API after this reply.
    if (target === current) {
      return {
        ok: false,
        action,
        sessionId: target,
        reason:
          "I can't delete the session I'm answering in right now; the operation would wait for this turn to finish.",
        doItNow: {
          clearHistory: `POST ${selfUrl()}/eve/v1/session/${target}/clear`,
          resetSession: `POST ${selfUrl()}/eve/v1/session/${target}/reset`,
          note: "In the web chat, use the Clear or Reset button instead.",
        },
      };
    }

    const secret = process.env.AGENT_API_KEY_SECRET;
    if (!secret) {
      throw new Error(
        "AGENT_API_KEY_SECRET is not set, so I cannot authenticate to my own control API. Set it in .env and restart.",
      );
    }

    const token = await signAgentToken({
      secret,
      subject: "self-delete-history",
      ttlSeconds: 60,
    });

    const response = await fetch(`${selfUrl()}/eve/v1/session/${target}/${action}`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`History ${action} failed (${response.status}): ${text}`);
    }

    return {
      ok: true,
      action,
      sessionId: target,
      note:
        action === "reset"
          ? "Session retired. Start a new session for a fresh conversation."
          : "Conversation history cleared; session, tools, memory, and skills are preserved.",
    };
  },
});
