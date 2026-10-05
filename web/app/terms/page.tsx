import Link from "next/link";
import { siteConfig } from "@/lib/site";

export const metadata = {
  title: `Terms of Service — ${siteConfig.name}`,
  description: `Terms of Service for ${siteConfig.name}.`,
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800 px-6 py-4">
        <Link href="/" className="font-semibold">{siteConfig.name}</Link>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-3xl font-bold">Terms of Service</h1>
        <p className="mt-2 text-sm text-zinc-500">
          Last updated: {new Date().toLocaleDateString("en-GB", { year: "numeric", month: "long" })} ·{" "}
          {siteConfig.companyName} · Org. no. {siteConfig.organizationNumber} · {siteConfig.taxCountry}
        </p>

        <section className="mt-8 space-y-6 text-sm leading-relaxed text-zinc-300">
          <div>
            <h2 className="text-lg font-semibold text-zinc-100">1. Who we are</h2>
            <p className="mt-2">
              {siteConfig.name} ("the Service", "we", "us") is provided by{" "}
              {siteConfig.companyName}, organisation number {siteConfig.organizationNumber},{" "}
              {siteConfig.taxCountry}. By creating an account or using the Service you agree to
              these Terms of Service. If you do not agree, do not use the Service.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-zinc-100">2. The Service</h2>
            <p className="mt-2">
              {siteConfig.name} is an AI assistant that can search the web, remember context
              between conversations, and connect to third-party apps you authorise. AI-generated
              content may be inaccurate or incomplete — always verify important information
              before relying on it. The Service is not a substitute for professional advice.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-zinc-100">3. Accounts</h2>
            <p className="mt-2">
              You must provide accurate information and keep your credentials secure. You are
              responsible for activity under your account. We may suspend accounts that violate
              these terms or applicable law.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-zinc-100">4. Plans, tokens and payment</h2>
            <p className="mt-2">
              Paid plans include a token allowance valid for the period shown at checkout.
              Pay-as-you-go top-ups are prepaid and consumed as tokens are used. Prices are
              listed on our <Link className="text-blue-400 hover:underline" href="/pricing">pricing page</Link>.
              Upgrades take effect immediately; downgrades and cancellations take effect at the
              end of the current period. Tokens already consumed are non-refundable. Payments are
              processed by our payment providers (for example Stripe, PayPal, or crypto).
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-zinc-100">5. Acceptable use</h2>
            <p className="mt-2">
              You agree not to use the Service to break the law, infringe rights, distribute
              malware, attempt to gain unauthorised access, resell access without permission, or
              generate harmful content. We may rate-limit or block abusive usage.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-zinc-100">6. Third-party apps</h2>
            <p className="mt-2">
              You may connect third-party services (for example Google or Slack). Those services
              are governed by their own terms and privacy policies. We only access what you
              authorise, and you can disconnect at any time from your dashboard. We are not
              responsible for third-party services.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-zinc-100">7. Intellectual property</h2>
            <p className="mt-2">
              The Service, including its software and design, is owned by {siteConfig.companyName}
              and protected by law. You keep ownership of the content you submit. You grant us a
              limited licence to process your content solely to operate the Service. See also our{" "}
              <Link className="text-blue-400 hover:underline" href="/privacy">Privacy Policy</Link>{" "}
              and <Link className="text-blue-400 hover:underline" href="/copyright">Legal notice</Link>.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-zinc-100">8. Availability and changes</h2>
            <p className="mt-2">
              We aim for high availability but do not guarantee uninterrupted service. We may
              modify or discontinue features, and we may update these terms. Material changes will
              be communicated through the Service or by email.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-zinc-100">9. Limitation of liability</h2>
            <p className="mt-2">
              The Service is provided "as is" without warranties beyond what mandatory law
              requires. To the fullest extent permitted by law, {siteConfig.companyName} is not
              liable for indirect or consequential damages, or for decisions made based on
              AI-generated output. Our total liability is limited to the amount you paid in the
              last 3 months.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-zinc-100">10. Termination</h2>
            <p className="mt-2">
              You may stop using the Service and close your account at any time. We may terminate
              or suspend access for breach of these terms. Provisions that by nature should
              survive (such as liability limits) will survive termination.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-zinc-100">11. Governing law</h2>
            <p className="mt-2">
              These terms are governed by the laws of {siteConfig.taxCountry}. Disputes are
              subject to the ordinary courts of {siteConfig.taxCountry}.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-zinc-100">12. Contact</h2>
            <p className="mt-2">
              {siteConfig.companyName}, {siteConfig.taxCountry} · Org. no.{" "}
              {siteConfig.organizationNumber} ·{" "}
              <a className="text-blue-400 hover:underline" href={`mailto:${siteConfig.supportEmail}`}>
                {siteConfig.supportEmail}
              </a>{" "}
              · WhatsApp{" "}
              <a className="text-blue-400 hover:underline" href={siteConfig.supportWhatsAppUrl}>
                {siteConfig.supportWhatsAppUrl.replace("https://", "")}
              </a>{" "}
              · {siteConfig.supportHours}
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
