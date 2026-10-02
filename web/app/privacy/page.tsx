import Link from "next/link";
import { siteConfig } from "@/lib/site";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800 px-6 py-4">
        <Link href="/" className="font-semibold">{siteConfig.name}</Link>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-3xl font-bold">Privacy Policy</h1>
        <p className="mt-2 text-sm text-zinc-500">
          {siteConfig.companyName} · Org. no. {siteConfig.organizationNumber} · {siteConfig.taxCountry}
        </p>

        <section className="mt-8 space-y-6 text-sm leading-relaxed text-zinc-300">
          <div>
            <h2 className="text-lg font-semibold text-zinc-100">1. Who we are</h2>
            <p className="mt-2">
              {siteConfig.companyName} (organization number {siteConfig.organizationNumber}),
              based in {siteConfig.taxCountry}, operates {siteConfig.name} ("the Service").
              We are the data controller for the personal data described below.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-zinc-100">2. Data we collect</h2>
            <p className="mt-2">Depending on how you register and use the Service, we collect:</p>
            <ul className="mt-2 list-disc space-y-1 pl-6">
              <li>Account data: name, email address, and — if you choose email registration — a password (stored only as a salted Argon2id hash).</li>
              <li>Contact data: phone number, country, address, and postal code.</li>
              <li>Social security number / fødselsnummer, if you choose to provide it (see section 3).</li>
              <li>Usage data: conversations, token usage, saved artifacts, notebook reminders, and connected apps.</li>
              <li>Payment data: handled by our payment providers (Stripe, PayPal) — we do not store full card numbers.</li>
            </ul>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-zinc-100">3. How we protect your Social Security Number</h2>
            <p className="mt-2">
              Your social security number is treated as sensitive data. It is encrypted with
              AES-256-GCM using a unique key per record, and that key is itself wrapped with a
              master key held separately from the database. It is stored separately from the rest
              of your account, masked in our interface, never logged, and never shared with
              third parties. Access is logged and restricted.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-zinc-100">4. Why we collect it</h2>
            <p className="mt-2">
              We process your data to provide and secure the Service, manage subscriptions and
              payments, comply with legal obligations, and improve the product. We only process
              what is necessary and never sell your personal data.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-zinc-100">5. Third parties</h2>
            <p className="mt-2">
              We use trusted processors: Vercel (hosting), Neon (database), Stripe and PayPal
              (payments), Google and Apple (sign-in), and AI model providers. Each processes data
              only to perform its service under a data-processing agreement.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-zinc-100">6. Your rights</h2>
            <p className="mt-2">
              Under the GDPR you have the right to access, correct, delete, and export your data,
              and to object to or restrict processing. Contact us via the support channels below.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-zinc-100">7. Retention</h2>
            <p className="mt-2">
              We keep your data for as long as your account is active, and then only as long as
              required by law (for example, accounting rules). You may delete your account at any
              time and we will erase or anonymize your data.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-zinc-100">8. Contact</h2>
            <p className="mt-2">
              WhatsApp:{" "}
              <a className="text-blue-400 hover:underline" href={siteConfig.supportWhatsAppUrl}>
                {siteConfig.supportWhatsAppUrl.replace("https://", "")}
              </a>{" "}
              · {siteConfig.supportHours} · Email: {siteConfig.supportEmail}
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
