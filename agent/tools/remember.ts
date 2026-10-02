import { defineTool } from "eve/tools";
import { z } from "zod";
import { putMemory } from "../lib/memory-store";

export default defineTool({
  description:
    "Remember one stable fact or preference about the current user, so it survives across sessions. Use when the user shares something durable about themselves or their project.",
  inputSchema: z.object({
    key: z
      .string()
      .min(1)
      .max(80)
      .regex(/^[a-z0-9_.-]+$/)
      .describe("Short identifier, e.g. 'user-name' or 'preferred-stack'."),
    value: z
      .string()
      .min(1)
      .max(4000)
      .describe("The fact or preference to store."),
  }),
  async execute({ key, value }, ctx) {
    const userId = ctx.session.auth?.current?.principalId ?? "local";
    await putMemory(userId, key, value);
    return { ok: true, key };
  },
});
