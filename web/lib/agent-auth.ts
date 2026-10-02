import { SignJWT } from "jose";

const AGENT_ISSUER = "my-ai-agent";
const AGENT_AUDIENCE = "my-ai-agent-api";

export async function createAgentToken(userId: string): Promise<string> {
  const secret = process.env.AGENT_API_KEY_SECRET;
  if (!secret) throw new Error("AGENT_API_KEY_SECRET is not configured.");

  return new SignJWT({ scope: "agent" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(AGENT_ISSUER)
    .setAudience(AGENT_AUDIENCE)
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(new TextEncoder().encode(secret));
}