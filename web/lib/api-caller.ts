import { auth } from "@/auth";
import { resolveCliToken } from "@/lib/cli-tokens";
import { isUnlimited } from "@/lib/entitlements";

// ---------------------------------------------------------------------------
// Who is calling the public HTTP API?
//
// Two ways in:
//   1. the browser session cookie (the dashboard's own chat), or
//   2. `Authorization: Bearer tai_...` — a CLI/API key created under
//      Dashboard → API keys. This is what the `tech-ai` command, your own
//      server, and an OpenAI-compatible client such as VS Code use.
// ---------------------------------------------------------------------------

export interface ApiCaller {
  userId: string;
  email: string | null;
  role: string;
  /** Owner/admin: never metered, never blocked by a paywall. */
  unlimited: boolean;
}

/** Extract the bearer value from an Authorization header, or "". */
export function bearerFrom(request: Request): string {
  const header = request.headers.get("authorization") ?? "";
  return header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
}

export async function resolveApiCaller(request: Request): Promise<ApiCaller | null> {
  const session = await auth();
  if (session?.user?.id) {
    const { id, email, role } = session.user;
    return {
      userId: id,
      email: email ?? null,
      role: role ?? "user",
      unlimited: isUnlimited({ id, email, role }),
    };
  }

  const bearer = bearerFrom(request);
  if (bearer) {
    const user = await resolveCliToken(bearer);
    if (user) {
      return {
        userId: user.id,
        email: user.email,
        role: user.role,
        unlimited: isUnlimited(user),
      };
    }
  }

  return null;
}
