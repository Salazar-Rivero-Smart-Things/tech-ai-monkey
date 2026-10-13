import { defineTool } from "eve/tools";
import { z } from "zod";
import { callerKeyFromAuth, isOwnerRole, saveLearnedSkill } from "../lib/skills-store";

/** Read the caller's role from the verified session auth attributes. */
function roleOf(attributes: Record<string, string | readonly string[]> | undefined) {
  const raw = attributes?.role;
  if (Array.isArray(raw)) return raw[0];
  return raw as string | undefined;
}

export default defineTool({
  description:
    "Save a reusable skill: a short procedure the agent should follow for a specific kind of question. " +
    "Use when the user says 'learn this', 'remember how we do X', or teaches a repeatable workflow. " +
    "Default scope is 'personal' (only this user). Set scope 'global' only when the user explicitly wants " +
    "everybody who uses the app to get the skill, and only the instance owner may do so. " +
    "Re-using a name overwrites the previous version.",
  inputSchema: z.object({
    name: z
      .string()
      .min(3)
      .max(80)
      .describe("Short human title, e.g. 'Deploy to the server'."),
    description: z
      .string()
      .min(10)
      .max(400)
      .describe(
        "When to use this skill — the kind of question that should load it, written as a routing hint, e.g. 'Use when the user asks to deploy, restart or roll back the production services.'",
      ),
    procedure: z
      .string()
      .min(20)
      .max(20_000)
      .describe("The procedure itself, as markdown steps the agent will follow."),
    triggers: z
      .array(z.string().min(2).max(120))
      .max(12)
      .optional()
      .describe("Example questions or phrases that should activate the skill."),
    scope: z
      .enum(["personal", "global"])
      .default("personal")
      .describe("'personal' = just this user; 'global' = everyone (owner only)."),
  }),
  async execute({ name, description, procedure, triggers, scope }, ctx) {
    const auth = ctx.session.auth?.current;
    const callerKey = callerKeyFromAuth(auth);
    const owner = isOwnerRole(roleOf(auth?.attributes));

    if (scope === "global" && !owner) {
      return {
        ok: false,
        error:
          "Only the instance owner can publish a skill for everybody. Saved as personal instead? Ask, or use the Skills page in the dashboard.",
        suggestion: "Re-run with scope 'personal', or publish it from Dashboard → Skills.",
      };
    }

    const skill = await saveLearnedSkill({
      name,
      description,
      body: procedure,
      triggers,
      scope,
      createdBy: callerKey,
    });

    return {
      ok: true,
      slug: skill.slug,
      name: skill.name,
      scope: skill.scope,
      note:
        scope === "global"
          ? "Saved for everybody. It is loadable from the next turn on."
          : "Saved for this user only. It is loadable from the next turn on.",
    };
  },
});
