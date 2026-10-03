import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

/**
 * The very first account created becomes the admin; everyone after is a
 * regular user. Used by the email/password signup route so that "first
 * registrant = admin" holds for that flow.
 */
export async function roleForNewUser(): Promise<"admin" | "user"> {
  const [existing] = await db.select({ id: users.id }).from(users).limit(1);
  return existing ? "user" : "admin";
}

export function isAdmin(role: string | undefined | null): boolean {
  return role === "admin";
}
