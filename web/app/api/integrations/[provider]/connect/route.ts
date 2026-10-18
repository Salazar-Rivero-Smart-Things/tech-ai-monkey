import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  PROVIDERS,
  getCredentials,
  isProviderId,
  type ProviderConfig,
} from "@/lib/integrations/providers";
import { signState } from "@/lib/integrations/state";

export const dynamic = "force-dynamic";

function baseUrl(req: Request): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "") ?? new URL(req.url).origin
  );
}

function authorizeUrl(
  cfg: ProviderConfig,
  clientId: string,
  redirectUri: string,
  state: string,
): string {
  const url = new URL(cfg.authorizeEndpoint);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("scope", cfg.scopes.join(cfg.scopeSeparator));
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("response_type", "code");
  for (const [k, v] of Object.entries(cfg.extraAuthParams ?? {})) {
    url.searchParams.set(k, v);
  }
  return url.toString();
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  let { provider } = await params;
  const base = baseUrl(req);
  const back = (query: string) =>
    NextResponse.redirect(new URL(`/dashboard/apps?${query}`, base));

  const session = await auth();
  if (!session?.user?.id) return NextResponse.redirect(new URL("/signin", base));

  // Route google_calendar and google_meet through the registered 'google' OAuth client
  // so users never hit Google's redirect_uri_mismatch error.
  if (provider === "google_calendar" || provider === "google_meet") {
    provider = "google";
  }

  if (!isProviderId(provider)) return back("error=unknown_provider");
  const cfg = PROVIDERS[provider];

  const creds = getCredentials(cfg);
  if (!creds) return back(`error=not_configured&provider=${provider}`);

  const redirectUri = `${base}/api/integrations/${provider}/callback`;
  const state = await signState({ userId: session.user.id, provider });

  return NextResponse.redirect(authorizeUrl(cfg, creds.clientId, redirectUri, state));
}
