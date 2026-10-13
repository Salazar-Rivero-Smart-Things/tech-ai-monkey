import { SignJWT } from "jose";

const AGENT_ISSUER = "my-ai-agent";
const AGENT_AUDIENCE = "my-ai-agent-api";

export interface AgentTokenClaims {
  /** RBAC role, so the agent can gate "publish for everybody". */
  role?: string | null;
  /** Caller email (owner allow-list checks happen in the web app). */
  email?: string | null;
}

/**
 * Mint the short-lived token the web app uses to call the eve agent.
 *
 * `sub` is the user id; eve surfaces it as `ctx.session.auth.current.subject`
 * and exposes every other claim (role, email) through `.attributes`.
 */
export async function createAgentToken(
  userId: string,
  claims: AgentTokenClaims = {},
): Promise<string> {
  const secret = process.env.AGENT_API_KEY_SECRET;
  if (!secret) throw new Error("AGENT_API_KEY_SECRET is not configured.");

  const payload: Record<string, unknown> = { scope: "agent" };
  if (claims.role) payload.role = claims.role;
  if (claims.email) payload.email = claims.email;

  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(AGENT_ISSUER)
    .setAudience(AGENT_AUDIENCE)
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(new TextEncoder().encode(secret));
}