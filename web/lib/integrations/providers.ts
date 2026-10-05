// ---------------------------------------------------------------------------
// OAuth provider registry for "Apps to connect".
//
// Every endpoint below is taken from the providers' official docs (verified):
//  - Slack:   https://docs.slack.dev/authentication/installing-with-oauth
//  - Google:  https://developers.google.com/identity/protocols/oauth2/web-server
//
// Nothing here contacts a provider until the user clicks Connect, and Connect
// only works once the matching client id/secret are set in the environment.
// ---------------------------------------------------------------------------

export type ProviderId = "slack" | "google_workspace" | "google";

export interface ProviderConfig {
  id: ProviderId;
  name: string;
  description: string;
  /** Env var holding the OAuth client id. */
  clientIdEnv: string;
  /** Env var holding the OAuth client secret. */
  clientSecretEnv: string;
  /** Fallback env vars (used by Google, which shares the login OAuth client). */
  clientIdFallbackEnv?: string;
  clientSecretFallbackEnv?: string;
  /** Where the user creates/administers the app and gets the credentials. */
  setupUrl: string;
  /** Official docs for the flow + which redirect URI to register. */
  docsUrl: string;
  scopes: string[];
  /** Google wants a space-separated scope list; Slack wants commas. */
  scopeSeparator: string;
  authorizeEndpoint: string;
  tokenEndpoint: string;
  /** Extra query params sent on the authorize request. */
  extraAuthParams?: Record<string, string>;
  /** True if the provider requires an https redirect URI (blocks localhost). */
  requiresHttpsRedirect?: boolean;
}

export const PROVIDERS: Record<ProviderId, ProviderConfig> = {
  slack: {
    id: "slack",
    name: "Slack",
    description: "Messages, threads, and channels.",
    clientIdEnv: "SLACK_CLIENT_ID",
    clientSecretEnv: "SLACK_CLIENT_SECRET",
    setupUrl: "https://api.slack.com/apps",
    docsUrl: "https://docs.slack.dev/authentication/installing-with-oauth",
    scopes: ["channels:read", "chat:write", "users:read", "team:read"],
    scopeSeparator: ",",
    authorizeEndpoint: "https://slack.com/oauth/v2/authorize",
    tokenEndpoint: "https://slack.com/api/oauth.v2.access",
    requiresHttpsRedirect: true,
  },
  google_workspace: {
    id: "google_workspace",
    name: "Google Workspace",
    description: "Gmail, Drive, Docs, Calendar.",
    clientIdEnv: "GOOGLE_CLIENT_ID",
    clientSecretEnv: "GOOGLE_CLIENT_SECRET",
    clientIdFallbackEnv: "AUTH_GOOGLE_ID",
    clientSecretFallbackEnv: "AUTH_GOOGLE_SECRET",
    setupUrl: "https://console.cloud.google.com/apis/credentials",
    docsUrl: "https://developers.google.com/identity/protocols/oauth2/web-server",
    scopes: [
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/drive.readonly",
      "https://www.googleapis.com/auth/calendar.readonly",
    ],
    scopeSeparator: " ",
    authorizeEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenEndpoint: "https://oauth2.googleapis.com/token",
    extraAuthParams: {
      access_type: "offline",
      prompt: "consent",
      include_granted_scopes: "true",
    },
  },
  google: {
    id: "google",
    name: "Google services",
    description: "Search, Calendar, Maps, and more.",
    clientIdEnv: "GOOGLE_CLIENT_ID",
    clientSecretEnv: "GOOGLE_CLIENT_SECRET",
    clientIdFallbackEnv: "AUTH_GOOGLE_ID",
    clientSecretFallbackEnv: "AUTH_GOOGLE_SECRET",
    setupUrl: "https://console.cloud.google.com/apis/credentials",
    docsUrl: "https://developers.google.com/identity/protocols/oauth2/web-server",
    scopes: ["openid", "email", "https://www.googleapis.com/auth/calendar.readonly"],
    scopeSeparator: " ",
    authorizeEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenEndpoint: "https://oauth2.googleapis.com/token",
    extraAuthParams: { access_type: "offline", prompt: "consent" },
  },
};

export const PROVIDER_IDS = Object.keys(PROVIDERS) as ProviderId[];

export function isProviderId(value: string): value is ProviderId {
  return Object.prototype.hasOwnProperty.call(PROVIDERS, value);
}

export interface ProviderCredentials {
  clientId: string;
  clientSecret: string;
}

/** Reads an env var, treating missing OR empty ("VAR=") as unset. */
function env(name?: string): string | undefined {
  if (!name) return undefined;
  const value = process.env[name];
  return value && value.length > 0 ? value : undefined;
}

/** Reads the configured credentials for a provider, or null if not set up. */
export function getCredentials(cfg: ProviderConfig): ProviderCredentials | null {
  const clientId = env(cfg.clientIdEnv) ?? env(cfg.clientIdFallbackEnv);
  const clientSecret = env(cfg.clientSecretEnv) ?? env(cfg.clientSecretFallbackEnv);
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}
