import { defineTool } from "eve/tools";
import { z } from "zod";
import {
  callerKeyFromAuth,
  getLearnedSkill,
  isOwnerRole,
  removeLearnedSkill,
} from "../lib/skills-store";

export default defineTool({
  description:
    "Delete a learned skill by its slug. Without a scope, it removes the caller's personal skill first, then a global one if the caller is the instance owner. Cannot delete built-in skills.",
  inputSchema: z.object({
    slug: z.string().min(1).max(60).describe("The skill slug, e.g. 'deploy-to-the-server'."),
    scope: z
      .enum(["personal", "global"])
      .optional()
      .describe("Which library to delete from. Defaults to personal, then global for the owner."),
  }),
  async execute({ slug, scope }, ctx) {
    const auth = ctx.session.auth?.current;
    const callerKey = callerKeyFromAuth(auth);
    const owner = isOwnerRole(
      Array.isArray(auth?.attributes?.role)
        ? (auth?.attributes?.role as readonly string[])[0]
        : (auth?.attributes?.role as string | undefined),
    );

    const scopes = scope ? [scope] : (["personal", "global"] as const);
    for (const candidate of scopes) {
      if (candidate === "global" && !owner) continue;
      const existing = await getLearnedSkill(candidate, callerKey, slug);
      if (!existing) continue;
      const removed = await removeLearnedSkill(candidate, callerKey, existing.slug);
      if (removed) {
        return { ok: true, slug: existing.slug, scope: candidate, name: existing.name };
      }
    }

    return {
      ok: false,
      error: `No learned skill '${slug}' was found${scope ? ` in the ${scope} library` : ""}.`,
    };
  },
});
