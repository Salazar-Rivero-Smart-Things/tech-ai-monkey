import { SignJWT, jwtVerify } from "jose";

// ---------------------------------------------------------------------------
// Short-lived, signed `state` for the OAuth round-trip. Signed with AUTH_SECRET
// so the callback can prove the request started with a logged-in user (CSRF).
// ---------------------------------------------------------------------------

const TTL_SECONDS = 600; // 10 minutes — OAuth codes are single-use and short-lived.

function key(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set — cannot sign OAuth state.");
  return new TextEncoder().encode(secret);
}

export interface OAuthState {
  userId: string;
  provider: string;
}

export async function signState(state: OAuthState): Promise<string> {
  return new SignJWT({ ...state })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(new Date(Date.now() + TTL_SECONDS * 1000))
    .sign(key());
}

export async function verifyState(token: string): Promise<OAuthState | null> {
  try {
    const { payload } = await jwtVerify(token, key());
    if (typeof payload.userId !== "string" || typeof payload.provider !== "string") {
      return null;
    }
    return { userId: payload.userId, provider: payload.provider };
  } catch {
    return null;
  }
}
