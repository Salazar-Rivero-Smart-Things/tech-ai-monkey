import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { workflows, workflowRuns } from "@/lib/db/schema";
import WorkflowForm from "./WorkflowForm";
import WorkflowList from "./WorkflowList";

export default async function WorkflowsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");

  const userWorkflows = await db
    .select()
    .from(workflows)
    .where(eq(workflows.userId, session.user.id))
    .orderBy(desc(workflows.createdAt));

  const recentRuns = await db
    .select()
    .from(workflowRuns)
    .where(eq(workflowRuns.userId, session.user.id))
    .orderBy(desc(workflowRuns.startedAt))
    .limit(30);

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-white">Workflows & Automatisering</h1>
        <p className="text-sm text-zinc-400 mt-1">
          Sett opp automatiske rutiner, planlagte analyser og få rapporter levert direkte til e-posten din.
        </p>
      </div>

      <WorkflowForm userEmail={session.user.email ?? undefined} />

      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium text-white">Dine aktive rutiner</h2>
          <span className="text-xs text-zinc-500">
            {userWorkflows.length} {userWorkflows.length === 1 ? "rutine" : "rutiner"} registrert
          </span>
        </div>

        <WorkflowList workflows={userWorkflows} runs={recentRuns} />
      </div>
    </div>
  );
}
