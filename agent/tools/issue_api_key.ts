import { defineTool } from "eve/tools";
import { z } from "zod";
import { signAgentToken } from "../lib/jwt";

export default defineTool({
  description:
    "Issue an API key (a signed bearer token) so the caller's server can talk to this agent's HTTP API. Use when the user asks for an API key or wants to hook up their server.",
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
      warning:
        "Treat this key like a password. Anyone holding it can use the agent on your behalf. Rotating AGENT_API_KEY_SECRET revokes every issued key at once.",
    };
  },
});
