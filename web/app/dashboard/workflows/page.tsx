import { redirect } from "next/navigation";
import { auth } from "@/auth";

export default async function WorkflowsPage() {
  const session = await auth();
  if (!session?.user) redirect("/signin");

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Workflows</h1>
        <p className="text-sm text-zinc-400">
          Multi-step automations you save and re-run.
        </p>
      </div>
      <p className="text-sm text-zinc-500">
        No workflows yet — this will connect to the agent&apos;s durable workflow runs.
      </p>
    </div>
  );
}
