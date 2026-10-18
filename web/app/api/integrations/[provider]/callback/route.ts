import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { integrations } from "@/lib/db/schema";
import {
  PROVIDERS,
  getCredentials,
  isProviderId,
  type ProviderConfig,
} from "@/lib/integrations/providers";
import { verifyState } from "@/lib/integrations/state";
import { encryptSecret } from "@/lib/security/crypto";

export const dynamic = "force-dynamic";

interface TokenResult {
  ok: boolean;
  error?: string;
  account?: string | null;
  scope?: string | null;
  raw?: unknown;
}

/** Exchanges the authorization code for tokens (form-encoded, per provider docs). */
async function exchangeCode(
  cfg: ProviderConfig,
  clientId: string,
  clientSecret: string,
  code: string,
  redirectUri: string,
): Promise<TokenResult> {
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });

  let res: Response;
  try {
    res = await fetch(cfg.tokenEndpoint, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        accept: "application/json",
      },
      body,
    });
  } catch {
    return { ok: false, error: "token_request_failed" };
  }

  const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!res.ok || !json) return { ok: false, error: `token_http_${res.status}` };
  // Slack returns HTTP 200 with { ok: false, error } on failure.
  if (json.ok === false) return { ok: false, error: String(json.error ?? "oauth_error") };

  const accessToken =
    typeof json.access_token === "string"
      ? json.access_token
      : typeof (json.authed_user as Record<string, unknown> | undefined)?.access_token === "string"
        ? ((json.authed_user as Record<string, unknown>).access_token as string)
        : null;
  if (!accessToken) return { ok: false, error: "no_access_token" };

  const team = json.team as { name?: string } | undefined;
  const account = typeof team?.name === "string" ? team.name : null;

  return {
    ok: true,
    account,
    scope: typeof json.scope === "string" ? json.scope : null,
    raw: json,
  };
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;
  const base = (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "") ?? new URL(req.url).origin
  );
  const back = (query: string) =>
    NextResponse.redirect(new URL(`/dashboard/apps?${query}`, base));

  if (!isProviderId(provider)) return back("error=unknown_provider");
  const cfg = PROVIDERS[provider];

  const url = new URL(req.url);
  const providerError = url.searchParams.get("error");
  if (providerError) {
    return back(`error=${encodeURIComponent(providerError)}&provider=${provider}`);
  }

  const code = url.searchParams.get("code");
  const stateParam = url.searchParams.get("state");
  if (!code || !stateParam) return back(`error=missing_code&provider=${provider}`);

  const state = await verifyState(stateParam);
  if (!state || state.provider !== provider) return back(`error=bad_state&provider=${provider}`);

  const session = await auth();
  if (!session?.user?.id || session.user.id !== state.userId) {
    return back("error=session_mismatch");
  }

  const creds = getCredentials(cfg);
  if (!creds) return back(`error=not_configured&provider=${provider}`);

  const redirectUri = `${base}/api/integrations/${provider}/callback`;
  const result = await exchangeCode(
    cfg,
    creds.clientId,
    creds.clientSecret,
    code,
    redirectUri,
  );
  if (!result.ok) {
    return back(`error=${encodeURIComponent(result.error ?? "oauth_error")}&provider=${provider}`);
  }

  // Tokens are stored encrypted (AES-256-GCM envelope, KEK = SSN_KEK).
  const metadata = {
    connectedAt: new Date().toISOString(),
    account: result.account ?? null,
    scopes: result.scope ?? null,
    secret: encryptSecret(JSON.stringify(result.raw)),
  };

  const providersToUpdate =
    provider === "google" ? ["google", "google_calendar", "google_meet"] : [provider];

  for (const p of providersToUpdate) {
    const [existing] = await db
      .select({ id: integrations.id })
      .from(integrations)
      .where(and(eq(integrations.userId, session.user.id), eq(integrations.provider, p)))
      .limit(1);

    if (existing) {
      await db
        .update(integrations)
        .set({ status: "connected", metadata, updatedAt: new Date() })
        .where(eq(integrations.id, existing.id));
    } else {
      await db.insert(integrations).values({
        id: randomUUID(),
        userId: session.user.id,
        provider: p,
        status: "connected",
        permission: "yes",
        metadata,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  }

  return back(`connected=${provider}`);
}
