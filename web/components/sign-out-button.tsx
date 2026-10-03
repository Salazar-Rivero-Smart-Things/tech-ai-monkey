"use client";

import { signOut } from "next-auth/react";

/**
 * Logout button usable from any page (client component).
 * Redirects to the given page after signing out.
 */
export default function SignOutButton({
  callbackUrl = "/",
  className,
  label = "Log out",
}: {
  callbackUrl?: string;
  className?: string;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl })}
      className={className}
    >
      {label}
    </button>
  );
}
