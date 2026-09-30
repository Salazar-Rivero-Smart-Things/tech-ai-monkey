import { SignJWT } from "jose";

// Must match the jwtHmac({ issuer, audiences }) config in channels/eve.ts.
export const AGENT_ISSUER = "my-ai-agent";
export const AGENT_AUDIENCE = "my-ai-agent-api";

export interface SignAgentTokenOptions {
  secret: string;
  subject?: string;
  ttlSeconds?: number;
  claims?: Record<string, unknown>;
}

// Mints the bearer tokens the agent hands out as "API keys". The default eve
// channel verifies them with jwtHmac({ secret, issuer, audiences }).
export function signAgentToken({
  secret,
  subject = "agent-api",
  ttlSeconds = 3600,
  claims = {},
}: SignAgentTokenOptions): Promise<string> {
  const key = new TextEncoder().encode(secret);
  return new SignJWT({ scope: "agent", ...claims })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(AGENT_ISSUER)
    .setAudience(AGENT_AUDIENCE)
    .setSubject(subject)
    .setIssuedAt()
    .setExpirationTime(new Date(Date.now() + ttlSeconds * 1000))
    .sign(key);
}
