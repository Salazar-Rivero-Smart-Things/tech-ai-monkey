import { importPKCS8, SignJWT } from "jose";

// Apple "Sign in with Apple" requires a short-lived JWT as its client secret.
// We build it at runtime from the raw .p8 key + IDs, so you only paste those
// values once — no pre-generated secret and no 6-month manual renewal.
// Returns undefined when the Apple env vars are not configured yet.
export async function appleClientSecret(): Promise<string | undefined> {
  const privateKey = process.env.AUTH_APPLE_PRIVATE_KEY;
  const keyId = process.env.AUTH_APPLE_KEY_ID;
  const teamId = process.env.AUTH_APPLE_TEAM_ID;
  const clientId = process.env.AUTH_APPLE_ID;

  if (!privateKey || !keyId || !teamId || !clientId) return undefined;

  try {
    const key = await importPKCS8(privateKey.replace(/\\n/g, "\n"), "ES256");
    return await new SignJWT({})
      .setProtectedHeader({ alg: "ES256", kid: keyId })
      .setIssuer(teamId)
      .setIssuedAt()
      .setExpirationTime("180d")
      .setAudience("https://appleid.apple.com")
      .setSubject(clientId)
      .sign(key);
  } catch {
    return undefined;
  }
}
