import type { Metadata } from "next";
import Link from "next/link";
import { siteConfig } from "@/lib/site";
import PrivacyPolicyContent from "@/components/privacy-policy-content";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How Tech AI monkey collects, uses, shares and protects personal data, and how you can access, export or delete your data.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPolicyHtmlPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800 px-6 py-4">
        <Link href="/" className="font-semibold">{siteConfig.name}</Link>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-12">
        <PrivacyPolicyContent />
      </main>
    </div>
  );
}
