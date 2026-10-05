import { defineTool } from "eve/tools";
import { z } from "zod";
import { signAgentToken } from "../lib/jwt";

export default defineTool({
  description:
    "Issue an API key (a signed bearer token) so the caller's server can talk to THIS agent's own HTTP API. Only for that. If the caller wants to use the agent from VS Code, an editor plugin, or the public API on tech-ai.tech, do not use this tool — tell them to create a key at https://tech-ai.tech/dashboard/api-keys and link the guide at https://tech-ai.tech/docs/vscode instead.",
  inputSchema: z.object({
    label: z
      .string()
      .min(1)
      .describe("What this key is for, e.g. 'my-node-server' or 'staging'."),
    expiresInHours: z
      .number()
      .int()
      .positive()
      .max(24 * 365)
      .default(24)
      .describe("How many hours the key stays valid. Default 24."),
  }),
  async execute({ label, expiresInHours }) {
    const secret = process.env.AGENT_API_KEY_SECRET;
    if (!secret) {
      throw new Error(
        "AGENT_API_KEY_SECRET is not set, so I cannot sign API keys. Add it to .env (a long random string), restart me, then ask again.",
      );
    }

    const apiKey = await signAgentToken({
      secret,
      subject: label,
      ttlSeconds: expiresInHours * 3600,
    });

    return {
      apiKey,
      label,
      expiresInHours,
      usage: {
        createSession: `POST /eve/v1/session {"message":"..."}  with header Authorization: Bearer <apiKey>`,
        continueSession: `POST /eve/v1/session/{sessionId} {"message":"..."}`,
        streamEvents: `GET /eve/v1/session/{sessionId}/stream`,
        clearHistory: `POST /eve/v1/session/{sessionId}/clear`,
        resetSession: `POST /eve/v1/session/{sessionId}/reset`,
      },
      whereToGetAKey: {
        dashboard: "https://tech-ai.tech/dashboard/api-keys",
        note:
          "Keys from the dashboard are the ones that work against the public API on tech-ai.tech. This agent-signed key only works against this agent's own HTTP API.",
      },
      openAiCompatible: {
        models: "GET https://tech-ai.tech/v1/models",
        chatCompletions: "POST https://tech-ai.tech/v1/chat/completions",
        vsCodeGuide: "https://tech-ai.tech/docs/vscode",
        note:
          "Use a tai_... key from the dashboard for these two endpoints, not the key returned above.",
      },
      warning:
        "Treat this key like a password. Anyone holding it can use the agent on your behalf. Rotating AGENT_API_KEY_SECRET revokes every issued key at once.",
    };
  },
});
