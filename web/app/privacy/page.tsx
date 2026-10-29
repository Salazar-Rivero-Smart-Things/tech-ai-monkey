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
              <li>Usage data: conversations, token usage, saved artifacts, notebook reminders, and connected apps.</li>
              <li>Payment data: handled by our payment providers (Stripe, PayPal) — we do not store full card numbers.</li>
            </ul>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-zinc-100">3. Why we collect it</h2>
            <p className="mt-2">
              We process your data to provide and secure the Service, manage subscriptions and
              payments, comply with legal obligations, and improve the product. We only process
              what is necessary and never sell your personal data.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-zinc-100">4. Sub-processors (third parties)</h2>
            <p className="mt-2">
              We never sell your personal data. We share it only with the sub-processors listed
              below, each under a data-processing agreement and only to the extent needed to run
              the Service. This list is kept up to date; the current version always applies.
            </p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-zinc-700 text-zinc-400">
                    <th className="py-2 pr-3 font-medium">Sub-processor</th>
                    <th className="py-2 pr-3 font-medium">Purpose</th>
                    <th className="py-2 font-medium">Data involved</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800 align-top">
                  <tr>
                    <td className="py-2 pr-3 whitespace-nowrap">{siteConfig.companyName} (own server, Norway)</td>
                    <td className="py-2 pr-3">Hosting the Service and the database</td>
                    <td className="py-2">All account data (encrypted at rest)</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-3 whitespace-nowrap">Cloudflare, Inc. (EU/USA)</td>
                    <td className="py-2 pr-3">DNS, DDoS protection and the encrypted tunnel to our server</td>
                    <td className="py-2">IP address and request metadata (TLS is terminated here)</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-3 whitespace-nowrap">Google Ireland Ltd (EU/USA)</td>
                    <td className="py-2 pr-3">Sign-in with Google, and the Google integrations you connect (Calendar, Drive, Gmail — read-only)</td>
                    <td className="py-2">Google account id, email address, and only the content you choose to connect</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-3 whitespace-nowrap">Slack Technologies / Salesforce (USA)</td>
                    <td className="py-2 pr-3">The Slack integration you connect</td>
                    <td className="py-2">Access tokens and the messages you ask the agent to handle</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-3 whitespace-nowrap">Stripe Payments Europe &amp; PayPal (EU/USA)</td>
                    <td className="py-2 pr-3">Card and PayPal payments, subscriptions and invoices</td>
                    <td className="py-2">Name, email and payment/billing data (we never store full card numbers)</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-3 whitespace-nowrap">{siteConfig.companyName} — Local Ollama Engine (Norway)</td>
                    <td className="py-2 pr-3">Self-hosted AI model (Ollama) that generates the agent&apos;s answers locally</td>
                    <td className="py-2">The text (prompt) you send to the agent — processed 100% on our own server in Norway</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-3 whitespace-nowrap">one.com (Denmark/EU)</td>
                    <td className="py-2 pr-3">Domain and email for {siteConfig.supportEmail}</td>
                    <td className="py-2">The email you send to support</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-zinc-100">5. Transfers outside the EEA</h2>
            <p className="mt-2">
              Your account data and AI chat prompts are processed and stored on our own server in
              Norway using our local <strong>Ollama</strong> AI engine — your chat prompts are{" "}
              <strong>never</strong> sent to external AI providers such as OpenAI or DeepSeek. A few
              optional infrastructure sub-processors are outside the EEA (Cloudflare, Slack, Stripe,
              and PayPal in the USA). Those transfers rely on the EU Standard Contractual Clauses
              and the additional safeguards required by the GDPR.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-zinc-100">6. Your rights</h2>
            <p className="mt-2">
              Under the GDPR you have the right to access, correct, delete, and export your data,
              and to object to or restrict processing. You can download everything we store from{" "}
              <span className="text-zinc-100">Dashboard → Privacy &amp; data → Download my data</span>{" "}
              and delete your account from the same page. You may also contact us via the support
              channels below, and you have the right to complain to your local data-protection
              authority (in Norway: Datatilsynet).
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-zinc-100">7. Retention (how long we keep data)</h2>
            <ul className="mt-2 list-disc space-y-1 pl-6">
              <li><span className="text-zinc-100">Account data</span> — while your account is active, then erased within 30 days of deletion.</li>
              <li><span className="text-zinc-100">Chat history and saved artifacts</span> — until you clear them or delete your account.</li>
              <li><span className="text-zinc-100">Connected-app tokens</span> — until you disconnect the app or delete your account.</li>
              <li><span className="text-zinc-100">Audit log</span> — 12 months.</li>
              <li><span className="text-zinc-100">Server and access logs</span> — 30 days.</li>
              <li><span className="text-zinc-100">Backups</span> — nightly encrypted-at-rest dumps kept for 30 days, plus one monthly copy kept for 12 months. Deleted data is gone from backups within 30 days.</li>
              <li><span className="text-zinc-100">Payment and accounting records</span> — 5 years, as required by the Norwegian Bookkeeping Act.</li>
              <li><span className="text-zinc-100">Support email</span> — 24 months.</li>
            </ul>
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
