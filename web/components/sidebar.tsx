"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

const NAV = [
  { href: "/dashboard/chat", label: "Chat with AI" },
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/artifacts", label: "Artifacts" },
  { href: "/dashboard/workflows", label: "Workflows" },
  { href: "/dashboard/apps", label: "Apps to connect" },
  { href: "/dashboard/notebook", label: "Notebook" },
  { href: "/dashboard/subscription", label: "Subscription" },
];

export default function Sidebar({ role }: { role?: string }) {
  const pathname = usePathname();
  const items =
    role === "admin"
      ? [NAV[0], { href: "/dashboard/admin", label: "Admin" }, ...NAV.slice(1)]
      : NAV;

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-zinc-800 bg-zinc-950">
      <div className="border-b border-zinc-800 px-4 py-4">
        <Link href="/dashboard" className="text-lg font-semibold">
          Tech AI monkey
        </Link>
        <p className="text-xs text-zinc-500">v1.0.0</p>
      </div>

      <nav className="flex-1 space-y-1 p-2">
        {items.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`block rounded-lg px-3 py-2 text-sm ${
                active ? "bg-zinc-800 text-white" : "text-zinc-400 hover:bg-zinc-900"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-zinc-800 p-2">
        <button
          onClick={() => signOut({ callbackUrl: "/signin" })}
          className="w-full rounded-lg px-3 py-2 text-left text-sm text-zinc-400 hover:bg-zinc-900 hover:text-red-400"
        >
          Log out
        </button>
      </div>
    </aside>
  );
}
