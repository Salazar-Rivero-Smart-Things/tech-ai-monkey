import { siteConfig } from "@/lib/site";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-zinc-100">{title}</h2>
      <div className="mt-2 space-y-2">{children}</div>
    </div>
  );
}

export default function PrivacyPolicyContent() {
  return (
    <>
      <h1 className="text-3xl font-bold">Privacy Policy</h1>
      <p className="mt-2 text-sm text-zinc-500">
        {siteConfig.companyName} · Org. no. {siteConfig.organizationNumber} · {siteConfig.taxCountry}
      </p>
      <p className="mt-1 text-xs text-zinc-500">
        Version {siteConfig.privacyPolicyVersion} · Last updated {siteConfig.privacyPolicyLastUpdated}
      </p>

      <section className="mt-8 space-y-6 text-sm leading-relaxed text-zinc-300">
        <Section title="1. Who we are">
          <p>
            {siteConfig.companyName} (organization number {siteConfig.organizationNumber}), based in{" "}
            {siteConfig.taxCountry}, operates {siteConfig.name} — the website at{" "}
            <span className="text-zinc-100">https://tech-ai.tech</span>, the assistant/agent, the
            desktop app, the command-line client, and the API (&quot;the Service&quot;).
          </p>
          <p>
            We are the data controller for the personal data described in this policy. You can reach
            us at <span className="text-zinc-100">{siteConfig.supportEmail}</span> or via WhatsApp at{" "}
            <span className="text-zinc-100">
              {siteConfig.supportWhatsAppUrl.replace("https://", "")}
            </span>{" "}
            ({siteConfig.supportHours}). We answer privacy requests within 30 days.
          </p>
        </Section>

        <Section title="2. Summary">
          <ul className="list-disc space-y-1 pl-6">
            <li>We collect the data needed to create your account, run the assistant, and bill you.</li>
            <li>We never sell your personal data and we do not use it for advertising.</li>
            <li>
              Your chat prompts are processed on our own server in {siteConfig.taxCountry} with a
              self-hosted AI model — they are not sent to OpenAI, Google, DeepSeek or similar
              providers, and they are not used to train third-party models.
            </li>
            <li>You can download or delete your data yourself from the dashboard, at any time.</li>
          </ul>
        </Section>

        <Section title="3. Data we collect">
          <p>Depending on how you register and use the Service, we collect the following:</p>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-700 text-zinc-400">
                  <th className="py-2 pr-3 font-medium">Category</th>
                  <th className="py-2 pr-3 font-medium">What it includes</th>
                  <th className="py-2 font-medium">Where it comes from</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800 align-top">
                <tr>
                  <td className="py-2 pr-3 whitespace-nowrap">Account data</td>
                  <td className="py-2 pr-3">
                    Name, email address, profile picture (if you sign in with Google or GitHub), and —
                    for email registration — a password stored only as a salted Argon2id hash. We
                    never see your plain-text password.
                  </td>
                  <td className="py-2">You, or the sign-in provider you choose</td>
                </tr>
                <tr>
                  <td className="py-2 pr-3 whitespace-nowrap">Contact data</td>
                  <td className="py-2 pr-3">Phone number, country, address and postal code, if you provide them.</td>
                  <td className="py-2">You</td>
                </tr>
                <tr>
                  <td className="py-2 pr-3 whitespace-nowrap">Usage data</td>
                  <td className="py-2 pr-3">
                    Conversations with the assistant, prompts and answers, token usage, saved
                    artifacts/files, notebook reminders, skills you add, and which apps you connect.
                  </td>
                  <td className="py-2">Generated when you use the Service</td>
                </tr>
                <tr>
                  <td className="py-2 pr-3 whitespace-nowrap">Connected-app data</td>
                  <td className="py-2 pr-3">
                    Access tokens for integrations you connect yourself (for example Google Calendar,
                    Drive or Gmail read-only, Slack), and only the content you ask the assistant to
                    read or handle.
                  </td>
                  <td className="py-2">The provider, after you grant permission</td>
                </tr>
                <tr>
                  <td className="py-2 pr-3 whitespace-nowrap">Payment data</td>
                  <td className="py-2 pr-3">
                    Subscription status, plan, invoices and the last four digits of a card. Full card
                    numbers are handled by our payment providers and never stored by us.
                  </td>
                  <td className="py-2">You and our payment providers (Stripe, PayPal)</td>
                </tr>
                <tr>
                  <td className="py-2 pr-3 whitespace-nowrap">Technical data</td>
                  <td className="py-2 pr-3">
                    IP address, user agent/browser, device type, timestamps, error and access logs,
                    and a session cookie that keeps you signed in.
                  </td>
                  <td className="py-2">Automatically, when you use the Service</td>
                </tr>
                <tr>
                  <td className="py-2 pr-3 whitespace-nowrap">Support data</td>
                  <td className="py-2 pr-3">The messages and attachments you send to support.</td>
                  <td className="py-2">You</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p>
            We do not intentionally collect special categories of data (health, religion, political
            opinions, biometric data, and similar). You are responsible for not putting such data —
            or other people&apos;s personal data — into prompts or files you upload.
          </p>
        </Section>

        <Section title="4. Legal bases (GDPR Article 6)">
          <ul className="list-disc space-y-1 pl-6">
            <li>
              <span className="text-zinc-100">Performance of a contract</span> — creating your account,
              running the assistant, delivering the subscription you paid for, and support.
            </li>
            <li>
              <span className="text-zinc-100">Legal obligation</span> — bookkeeping, invoices, tax, and
              responding to lawful requests from authorities.
            </li>
            <li>
              <span className="text-zinc-100">Legitimate interests</span> — keeping the Service secure
              and stable, preventing abuse and fraud, debugging errors, and improving the product.
              We balance these interests against your rights and never use them for advertising.
            </li>
            <li>
              <span className="text-zinc-100">Consent</span> — optional integrations (for example
              Google or Slack). You can withdraw consent at any time by disconnecting the app.
            </li>
          </ul>
        </Section>

        <Section title="5. What we use the data for">
          <ul className="list-disc space-y-1 pl-6">
            <li>Creating and administering your account and signing you in.</li>
            <li>Generating answers, remembering your preferences and project context between conversations.</li>
            <li>Counting token usage and enforcing the limits of your plan.</li>
            <li>Charging for subscriptions and producing invoices and accounting records.</li>
            <li>Detecting abuse, attacks and fraud, and keeping logs for security investigations.</li>
            <li>Answering support requests and fixing errors.</li>
            <li>Understanding which features are used, so we can improve them (aggregated statistics).</li>
          </ul>
          <p>
            We do not sell personal data, do not share it with data brokers or advertisers, and do not
            use your conversations for advertising. We do not use your content to train our own or
            anyone else&apos;s models without your explicit, separate consent.
          </p>
        </Section>

        <Section title="6. AI processing — where your prompts go">
          <p>
            The assistant is powered by a self-hosted model (Ollama) that runs on our own server in{" "}
            {siteConfig.taxCountry}. Your prompts, uploaded files and the generated answers are
            processed and stored there. They are <strong>not</strong> forwarded to external AI
            providers such as OpenAI, Anthropic, Google or DeepSeek.
          </p>
          <p>
            When the assistant searches the web, the search query — not your full conversation — is
            sent to a search provider. If you connect an app (for example Google Calendar), the
            assistant sends only the request needed to perform the action you asked for.
          </p>
        </Section>

        <Section title="7. Cookies and local storage">
          <ul className="list-disc space-y-1 pl-6">
            <li>
              <span className="text-zinc-100">Strictly necessary cookies</span> — a session cookie that
              keeps you signed in, and CSRF protection. These cannot be turned off without breaking
              sign-in.
            </li>
            <li>
              <span className="text-zinc-100">Local storage in the browser and desktop app</span> —
              remembers UI preferences and your last conversation locally on your device.
            </li>
            <li>
              <span className="text-zinc-100">No advertising cookies</span> — we do not use tracking,
              advertising or cross-site profiling cookies.
            </li>
          </ul>
          <p>
            You can delete cookies and local storage in your browser settings; you will then have to
            sign in again.
          </p>
        </Section>

        <Section title="8. Who we share data with (sub-processors)">
          <p>
            We share personal data only with the sub-processors listed below, each under a
            data-processing agreement and only to the extent needed to run the Service. This list is
            kept up to date; the current version always applies.
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
                  <td className="py-2 pr-3 whitespace-nowrap">
                    {siteConfig.companyName} (own server, Norway)
                  </td>
                  <td className="py-2 pr-3">Hosting the Service and the database</td>
                  <td className="py-2">All account data (encrypted at rest)</td>
                </tr>
                <tr>
                  <td className="py-2 pr-3 whitespace-nowrap">Cloudflare, Inc. (EU/USA)</td>
                  <td className="py-2 pr-3">
                    DNS, DDoS protection and the encrypted tunnel to our server
                  </td>
                  <td className="py-2">IP address and request metadata (TLS is terminated here)</td>
                </tr>
                <tr>
                  <td className="py-2 pr-3 whitespace-nowrap">Google Ireland Ltd (EU/USA)</td>
                  <td className="py-2 pr-3">
                    Sign-in with Google, and the Google integrations you connect (Calendar, Drive,
                    Gmail — read-only)
                  </td>
                  <td className="py-2">
                    Google account id, email address, and only the content you choose to connect
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-3 whitespace-nowrap">Slack Technologies / Salesforce (USA)</td>
                  <td className="py-2 pr-3">The Slack integration you connect</td>
                  <td className="py-2">Access tokens and the messages you ask the agent to handle</td>
                </tr>
                <tr>
                  <td className="py-2 pr-3 whitespace-nowrap">Stripe Payments Europe &amp; PayPal (EU/USA)</td>
                  <td className="py-2 pr-3">Card and PayPal payments, subscriptions and invoices</td>
                  <td className="py-2">
                    Name, email and payment/billing data (we never store full card numbers)
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-3 whitespace-nowrap">
                    {siteConfig.companyName} — Local Ollama Engine (Norway)
                  </td>
                  <td className="py-2 pr-3">
                    Self-hosted AI model (Ollama) that generates the agent&apos;s answers locally
                  </td>
                  <td className="py-2">
                    The text (prompt) you send to the agent — processed 100% on our own server in
                    Norway
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-3 whitespace-nowrap">one.com (Denmark/EU)</td>
                  <td className="py-2 pr-3">Domain and email for {siteConfig.supportEmail}</td>
                  <td className="py-2">The email you send to support</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p>
            We may also disclose data when we are legally required to do so, for example in response
            to a court order, or to establish, exercise or defend legal claims. If the business is
            sold or merged, data may be transferred to the new owner under the same terms as this
            policy, and we will notify you beforehand.
          </p>
        </Section>

        <Section title="9. Transfers outside the EEA">
          <p>
            Your account data and AI chat prompts are processed and stored on our own server in
            Norway using our local <strong>Ollama</strong> AI engine — your chat prompts are{" "}
            <strong>never</strong> sent to external AI providers such as OpenAI or DeepSeek. A few
            optional infrastructure sub-processors are outside the EEA (Cloudflare, Slack, Stripe,
            and PayPal in the USA). Those transfers rely on the EU Standard Contractual Clauses and
            the additional safeguards required by the GDPR.
          </p>
        </Section>

        <Section title="10. Security">
          <ul className="list-disc space-y-1 pl-6">
            <li>All traffic is encrypted with TLS 1.2 or newer.</li>
            <li>Passwords are stored only as salted Argon2id hashes.</li>
            <li>Access to production systems is restricted and protected with strong authentication.</li>
            <li>Database backups are encrypted at rest and stored with restricted file permissions.</li>
            <li>We log access and errors so that incidents can be investigated.</li>
          </ul>
          <p>
            No system is perfectly secure. If a breach affects your personal data, we notify the
            Norwegian Data Protection Authority (Datatilsynet) within 72 hours and inform you
            directly if the breach is likely to involve a high risk to your rights.
          </p>
        </Section>

        <Section title="11. How long we keep data (retention)">
          <ul className="list-disc space-y-1 pl-6">
            <li>
              <span className="text-zinc-100">Account data</span> — while your account is active, then
              erased within 30 days of deletion.
            </li>
            <li>
              <span className="text-zinc-100">Chat history and saved artifacts</span> — until you clear
              them or delete your account.
            </li>
            <li>
              <span className="text-zinc-100">Connected-app tokens</span> — until you disconnect the
              app or delete your account.
            </li>
            <li>
              <span className="text-zinc-100">Audit log</span> — 12 months.
            </li>
            <li>
              <span className="text-zinc-100">Server and access logs</span> — 30 days.
            </li>
            <li>
              <span className="text-zinc-100">Backups</span> — nightly encrypted-at-rest dumps kept for
              30 days, plus one monthly copy kept for 12 months. Deleted data is gone from backups
              within 30 days.
            </li>
            <li>
              <span className="text-zinc-100">Payment and accounting records</span> — 5 years, as
              required by the Norwegian Bookkeeping Act.
            </li>
            <li>
              <span className="text-zinc-100">Support email</span> — 24 months.
            </li>
          </ul>
        </Section>

        <Section title="12. Your rights">
          <p>
            Under the GDPR you have the right to access, correct, delete, and export your data, and to
            object to or restrict processing. You can download everything we store from{" "}
            <span className="text-zinc-100">Dashboard → Privacy &amp; data → Download my data</span>{" "}
            and delete your account from the same page. You may also contact us via the support
            channels below, and you have the right to complain to your local data-protection
            authority (in Norway: Datatilsynet, <span className="text-zinc-100">datatilsynet.no</span>).
          </p>
          <p>
            To protect your data, we may ask you to verify your identity before we act on a request.
            We answer within 30 days; if a request is complex we will tell you and explain why it
            takes longer.
          </p>
        </Section>

        <Section title="13. Automated decisions">
          <p>
            We do not make decisions with legal effect about you based solely on automated
            processing, and we do not build advertising profiles. Token limits and abuse protection
            are automated, but they only affect how much of the Service you can use — they do not
            make decisions about your person.
          </p>
        </Section>

        <Section title="14. Children">
          <p>
            The Service is not intended for children under 16, and we do not knowingly collect data
            about children. If you believe a child has created an account, contact us and we will
            delete it.
          </p>
        </Section>

        <Section title="15. Changes to this policy">
          <p>
            We may update this policy when the Service or the law changes. The current version and
            date are always shown at the top of this page, and the version number is increased for
            every material change. If a change significantly affects your rights, we will notify you
            by email or in the app before it takes effect.
          </p>
        </Section>

        <Section title="16. Contact">
          <p>
            WhatsApp:{" "}
            <a className="text-blue-400 hover:underline" href={siteConfig.supportWhatsAppUrl}>
              {siteConfig.supportWhatsAppUrl.replace("https://", "")}
            </a>{" "}
            · {siteConfig.supportHours} · Email: {siteConfig.supportEmail}
          </p>
          <p>
            {siteConfig.companyName}, org. no. {siteConfig.organizationNumber}, {siteConfig.taxCountry}.
          </p>
        </Section>
      </section>
    </>
  );
}
