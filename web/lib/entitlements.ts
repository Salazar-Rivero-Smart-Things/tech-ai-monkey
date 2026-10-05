// ---------------------------------------------------------------------------
// Entitlements — who gets unlimited access.
//
// The owner/administrator of the instance never hits a token limit or paywall.
// Everyone else is metered by lib/billing.
//
// An account is unlimited when either:
//   * its `role` is "admin" (the first account ever created is promoted to
//     admin — see web/auth.ts and lib/roles.ts), or
//   * its email is listed in the OWNER_EMAILS env var (comma-separated).
//
// Set OWNER_EMAILS in web/.env.local to be extra safe even if the role is lost:
//     OWNER_EMAILS=you@example.com,other@example.com
// ---------------------------------------------------------------------------

export interface EntitlementUser {
  id?: string | null;
  email?: string | null;
  role?: string | null;
}

export function ownerEmails(): string[] {
  return (process.env.OWNER_EMAILS ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

/** True for the instance owner — unlimited tokens, no paywall. */
export function isUnlimited(user: EntitlementUser | null | undefined): boolean {
  if (!user) return false;
  const role = (user.role ?? "").toLowerCase();
  if (role === "admin" || role === "owner") return true;
  const email = user.email?.trim().toLowerCase();
  return Boolean(email) && ownerEmails().includes(email as string);
}

/** Human-readable plan label used in the dashboard. */
export function planLabelFor(user: EntitlementUser | null | undefined): "Unlimited" | "Metered" {
  return isUnlimited(user) ? "Unlimited" : "Metered";
}
