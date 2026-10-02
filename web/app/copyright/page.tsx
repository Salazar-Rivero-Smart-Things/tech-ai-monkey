import Link from "next/link";
import { siteConfig } from "@/lib/site";

export default function CopyrightPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800 px-6 py-4">
        <Link href="/" className="font-semibold">{siteConfig.name}</Link>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-3xl font-bold">Copyright & legal notice</h1>
        <p className="mt-2 text-sm text-zinc-500">
          {siteConfig.companyName} · Org. no. {siteConfig.organizationNumber} · {siteConfig.taxCountry}
        </p>

        <section className="mt-8 space-y-6 text-sm leading-relaxed text-zinc-300">
          <div>
            <h2 className="text-lg font-semibold text-zinc-100">Copyright</h2>
            <p className="mt-2">
              © {new Date().getFullYear()} {siteConfig.companyName}. All rights reserved.
              All content, software, design, text, and graphics in {siteConfig.name} ("the
              Service") are the property of {siteConfig.companyName} or its licensors and are
              protected by copyright and other intellectual property laws.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-zinc-100">Trademarks</h2>
            <p className="mt-2">
              "{siteConfig.name}" and related logos are trademarks of {siteConfig.companyName}.
              Other product and company names mentioned may be trademarks of their respective
              owners.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-zinc-100">License to use</h2>
            <p className="mt-2">
              We grant you a limited, non-exclusive, non-transferable license to use the Service
              for your personal or internal business purposes, subject to these terms. You may
              not copy, modify, distribute, sell, or reverse-engineer the Service.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-zinc-100">Disclaimer</h2>
            <p className="mt-2">
              The Service is provided "as is" without warranties of any kind. AI-generated
              content may be inaccurate — verify important information independently. To the
              fullest extent permitted by law, {siteConfig.companyName} is not liable for
              indirect or consequential damages arising from use of the Service.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-zinc-100">Contact</h2>
            <p className="mt-2">
              {siteConfig.companyName}, {siteConfig.taxCountry} · Org. no.{" "}
              {siteConfig.organizationNumber} · WhatsApp:{" "}
              <a className="text-blue-400 hover:underline" href={siteConfig.supportWhatsAppUrl}>
                {siteConfig.supportWhatsAppUrl.replace("https://", "")}
              </a>{" "}
              · {siteConfig.supportHours} · {siteConfig.supportEmail}
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
