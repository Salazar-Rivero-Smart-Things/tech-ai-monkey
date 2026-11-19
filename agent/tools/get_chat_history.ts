import { defineTool } from "eve/tools";
import { z } from "zod";
import { signAgentToken } from "../lib/jwt";

const webAppUrl = () =>
  (process.env.WEB_APP_URL?.trim() || "http://127.0.0.1:3100").replace(/\/+$/, "");

export default defineTool({
  description:
    "Fetch and format the current user's saved conversation history (recent chats, last tasks, and past messages). " +
    "Use when the user asks for history, chat history, recent conversations, 'historikk', 'samtalehistorikk', 'historial', or wants to recall a past chat.",
  inputSchema: z.object({
    query: z
      .string()
      .max(120)
      .optional()
      .describe("Optional search keyword to filter conversations by title or message content."),
    limit: z
      .number()
      .int()
      .min(1)
      .max(30)
      .default(10)
      .describe("Maximum number of recent conversations to return (default 10)."),
    conversationId: z
      .string()
      .optional()
      .describe("Optional conversation ID to fetch the full message transcript of one specific chat."),
  }),
  async execute({ query, limit, conversationId }, ctx) {
    const authCurrent = (ctx.session.auth?.current ?? null) as
      | { subject?: string; principalId?: string }
      | null;
    const rawUserId = authCurrent?.subject ?? authCurrent?.principalId ?? "local";
    const userId = rawUserId.replace(/^[^:]+:/, "").trim() || "local";

    const secret = process.env.AGENT_API_KEY_SECRET;
    if (!secret) {
      return {
        ok: false,
        error: "AGENT_API_KEY_SECRET is not configured, so history lookup is unavailable.",
        dashboardUrl: "/dashboard/history",
      };
    }

    const token = await signAgentToken({
      secret,
      subject: userId,
      ttlSeconds: 60,
    });

    const base = webAppUrl();
    const url = conversationId
      ? `${base}/api/history/${encodeURIComponent(conversationId)}`
      : `${base}/api/history?limit=${limit}${query ? `&q=${encodeURIComponent(query)}` : ""}`;

    const res = await fetch(url, {
      headers: { authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return {
        ok: false,
        error: `History request failed (${res.status}): ${text || res.statusText}`,
        dashboardUrl: "/dashboard/history",
      };
    }

    const data = (await res.json()) as {
      ok?: boolean;
      conversations?: Array<{
        id: string;
        title: string;
        messageCount: number;
        lastMessageRole: string | null;
        lastMessagePreview: string;
        updatedAt: string;
      }>;
      conversation?: {
        id: string;
        title: string;
        updatedAt: string;
        messages: Array<{ role: string; content: string; createdAt: string }>;
      };
    };

    if (conversationId && data.conversation) {
      const c = data.conversation;
      return {
        ok: true,
        conversation: {
          id: c.id,
          title: c.title,
          updatedAt: c.updatedAt,
          openUrl: `/dashboard/chat?conversation=${encodeURIComponent(c.id)}`,
          messages: c.messages.slice(-40).map((m) => ({
            role: m.role,
            content: m.content.slice(0, 1200),
            createdAt: m.createdAt,
          })),
        },
      };
    }

    const conversations = data.conversations ?? [];
    return {
      ok: true,
      count: conversations.length,
      dashboardUrl: "/dashboard/history",
      conversations: conversations.map((c) => ({
        id: c.id,
        title: c.title,
        messageCount: c.messageCount,
        lastMessagePreview: c.lastMessagePreview,
        updatedAt: c.updatedAt,
        openUrl: `/dashboard/chat?conversation=${encodeURIComponent(c.id)}`,
      })),
    };
  },
});
