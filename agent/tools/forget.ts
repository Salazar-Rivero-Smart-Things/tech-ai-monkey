import { defineTool } from "eve/tools";
import { z } from "zod";
import { removeMemory } from "../lib/memory-store";

export default defineTool({
  description: "Forget a remembered fact or preference for the current user.",
  inputSchema: z.object({
    key: z.string().min(1).max(80).describe("The identifier of the memory to remove."),
  }),
  async execute({ key }, ctx) {
    const userId = ctx.session.auth?.current?.principalId ?? "local";
    const removed = await removeMemory(userId, key);
    return { ok: true, key, removed };
  },
});
