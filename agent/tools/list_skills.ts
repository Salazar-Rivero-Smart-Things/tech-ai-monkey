import { defineTool } from "eve/tools";
import { z } from "zod";
import {
  callerKeyFromAuth,
  listBuiltinSkills,
  listGlobalSkills,
  listPersonalSkills,
  summarize,
} from "../lib/skills-store";

export default defineTool({
  description:
    "List the skills the agent knows: the built-in ones shipped with the agent, the shared 'global' skills and the caller's own 'personal' skills. Use when the user asks what the agent has learned, or before creating a skill to check for an existing one.",
  inputSchema: z.object({
    includeBody: z
      .boolean()
      .default(false)
      .describe("Also return the full procedure text for each learned skill."),
  }),
  async execute({ includeBody }, ctx) {
    const auth = ctx.session.auth?.current;
    const callerKey = callerKeyFromAuth(auth);

    const [builtin, global, personal] = await Promise.all([
      listBuiltinSkills(),
      listGlobalSkills(),
      listPersonalSkills(callerKey),
    ]);

    const withBody = <T extends { slug: string }>(skill: T, body: string) =>
      includeBody ? { ...skill, body } : skill;

    return {
      builtin,
      global: global.map((skill) =>
        withBody(summarize(skill), skill.body),
      ),
      personal: personal.map((skill) =>
        withBody(summarize(skill), skill.body),
      ),
      counts: {
        builtin: builtin.length,
        global: global.length,
        personal: personal.length,
      },
    };
  },
});
