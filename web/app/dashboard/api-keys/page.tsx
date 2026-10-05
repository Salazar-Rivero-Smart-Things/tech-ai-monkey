import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import ApiKeyManager from "@/components/api-key-manager";
import { isUnlimited } from "@/lib/entitlements";

export default async function ApiKeysPage() {
  const session = await auth();
  if (!session?.user) redirect("/signin");

  const unlimited = isUnlimited({
    id: session.user.id,
    email: session.user.email,
    role: session.user.role,
  });

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">API keys</h1>
        <p className="text-sm text-zinc-400">
          Keys for the command-line app, for your own servers and for VS Code. Treat them like
          passwords.
        </p>
        <p className="mt-2 text-sm text-zinc-400">
          Using an editor or another tool?{" "}
          <Link href="/docs/vscode" className="text-blue-400 hover:underline">
            See the VS Code guide
          </Link>{" "}
          for a ready-made configuration.
        </p>
      </div>
      <ApiKeyManager unlimited={unlimited} />
    </div>
  );
}
