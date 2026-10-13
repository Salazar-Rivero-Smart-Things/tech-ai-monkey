import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import SkillManager, { type SkillItem } from "@/components/skill-manager";
import { isUnlimited } from "@/lib/entitlements";
import {
  listBuiltinSkills,
  listGlobalSkills,
  listPersonalSkills,
  summarize,
} from "@/lib/skills-store";

export const dynamic = "force-dynamic";

export default async function SkillsPage() {
  const session = await auth();
  if (!session?.user) redirect("/signin");

  const canPublish = isUnlimited({
    id: session.user.id,
    email: session.user.email,
    role: session.user.role,
  });

  const [builtin, global, personal] = await Promise.all([
    listBuiltinSkills(),
    listGlobalSkills(),
    listPersonalSkills(session.user.id),
  ]);

  const toItem = (skill: ReturnType<typeof summarize>): SkillItem => ({
    slug: skill.slug,
    name: skill.name,
    description: skill.description,
    triggers: skill.triggers,
    scope: skill.scope,
    updatedAt: skill.updatedAt,
  });

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Skills</h1>
        <p className="text-sm text-zinc-400">
          Skills are procedures the agent loads on demand for a specific kind of question. Teach one
          here, or just ask the agent in{" "}
          <Link href="/dashboard/chat" className="text-blue-400 hover:underline">
            chat
          </Link>{" "}
          — it will save it for you.
        </p>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 text-sm text-zinc-400">
        <p className="font-medium text-zinc-300">Where skills live</p>
        <ul className="mt-2 space-y-1">
          <li>
            <code className="text-zinc-300">skills/global/&lt;skill&gt;.md</code> — shared with every
            user (committed to the repository).
          </li>
          <li>
            <code className="text-zinc-300">skills/users/&lt;you&gt;/&lt;skill&gt;.md</code> — your
            private skills.
          </li>
        </ul>
        <p className="mt-2">
          The agent reads them at runtime, so a skill learned in a chat is available from the next
          turn on — no rebuild needed.
        </p>
      </div>

      <SkillManager
        builtin={builtin.map(toItem)}
        global={global.map((skill) => toItem(summarize(skill)))}
        personal={personal.map((skill) => toItem(summarize(skill)))}
        canPublish={canPublish}
      />
    </div>
  );
}
