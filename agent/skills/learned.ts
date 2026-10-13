import { defineDynamic, defineSkill } from "eve/skills";
import {
  advertisedDescription,
  callerKeyFromAuth,
  listLearnedSkills,
  type LearnedSkill,
} from "../lib/skills-store";

// ---------------------------------------------------------------------------
// Learned skills, served per caller.
//
// This is an eve dynamic skill resolver. On every session/turn start it reads
// the learned skills that the current caller may use (shared globals + their
// own personal ones) and advertises each one to the model with a `load_skill`
// entry. The description is the routing hint, so a skill is "linked" to the
// kind of questions it should answer.
//
// Nothing is written to the compiled bundle: the files live in skills/ at the
// repo root and are read at runtime, so a skill the agent learns today is
// available on the next turn without a rebuild.
// ---------------------------------------------------------------------------

function lower(skill: LearnedSkill) {
  return defineSkill({
    description: advertisedDescription(skill),
    markdown: skill.body,
    metadata: {
      scope: skill.scope,
      slug: skill.slug,
      name: skill.name,
      ...(skill.updatedAt ? { updatedAt: skill.updatedAt } : {}),
    },
  });
}

async function resolve(session: { auth?: { current?: unknown } } | undefined) {
  const current = (session?.auth?.current ?? null) as
    | { subject?: string; principalId?: string }
    | null;
  const callerKey = callerKeyFromAuth(current);

  let skills: LearnedSkill[];
  try {
    skills = await listLearnedSkills(callerKey);
  } catch {
    return null;
  }
  if (skills.length === 0) return null;

  // The resolver file slug is "learned", so a map entry keyed "deploy" is
  // advertised to the model as `learned__deploy`. That namespacing keeps a
  // learned skill from ever shadowing an authored one.
  return Object.fromEntries(skills.map((skill) => [skill.slug, lower(skill)]));
}

export default defineDynamic({
  events: {
    "session.started": (_event, ctx) => resolve(ctx.session),
    "turn.started": (_event, ctx) => resolve(ctx.session),
  },
});
