import { defineTool } from "eve/tools";
import { z } from "zod";
import { listMemories } from "../lib/memory-store";

export default defineTool({
  description: "List the long-term memories saved for the current user.",
  inputSchema: z.object({}),
  async execute(_input, ctx) {
    const userId = ctx.session.auth?.current?.principalId ?? "local";
    return await listMemories(userId);
  },
});
