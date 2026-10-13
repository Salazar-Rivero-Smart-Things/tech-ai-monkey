import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { artifacts } from "@/lib/db/schema";
import DownloadArtifactButton from "./DownloadArtifactButton";

export default async function ArtifactsPage() {
  const session = await auth();
  if (!session?.user) redirect("/signin");

  const items = await db
    .select()
    .from(artifacts)
    .where(eq(artifacts.userId, session.user.id))
    .orderBy(desc(artifacts.createdAt));

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Artifacts</h1>
        <p className="text-sm text-zinc-400">
          Documents, code, and files the AI produces for you.
        </p>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-zinc-500">
          No artifacts yet — they will appear here once the AI starts producing them.
        </p>
      ) : (
        <ul className="space-y-3">
          {items.map((a) => (
            <li key={a.id} className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 flex justify-between items-center">
              <div>
                <div className="font-medium">{a.title}</div>
                <div className="text-xs text-zinc-500">{a.kind}</div>
              </div>
              <DownloadArtifactButton artifactId={a.id} artifactTitle={a.title} artifactContent={a.content ?? ""} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
