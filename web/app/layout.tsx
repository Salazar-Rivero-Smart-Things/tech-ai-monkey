import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://tech-ai.tech"),
  title: {
    default: "Tech AI Monkey - Cheap AI, Super AI & Self-Improving Agent",
    template: "%s | Tech AI Monkey",
  },
  description:
    "Tech AI Monkey (tech-ai.tech) is a powerful, cheap AI and super AI assistant that searches the web, learns continuously, and provides self-hosted intelligence, coding VM sandboxes, and API access at fair prices.",
  keywords: [
    "cheap AI",
    "super AI",
    "cheap AI agent",
    "super AI agent",
    "affordable AI",
    "budget AI",
    "cheap artificial intelligence",
    "super artificial intelligence",
    "fair priced AI",
    "best cheap AI",
    "cheap AI alternative",
    "cheap ChatGPT alternative",
    "autonomous AI agent",
    "self-improving AI",
    "AI coding assistant",
    "AI coding sandbox",
    "deep web research AI",
    "tech-ai",
    "tech-ai.tech",
    "Tech AI Monkey",
    "developer AI API",
    "low cost AI subscription",
    "smart AI",
    "advanced AI",
  ],
  authors: [{ name: "Salazar Rivero Smart Things", url: "https://tech-ai.tech" }],
  creator: "Salazar Rivero Smart Things",
  publisher: "Salazar Rivero Smart Things",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: "https://tech-ai.tech",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://tech-ai.tech",
    siteName: "Tech AI Monkey",
    title: "Tech AI Monkey - Cheap AI, Super AI & Self-Improving Agent",
    description:
      "A fair-priced super AI that searches the web until it finds the answer, keeps learning, and provides private sandbox environments and APIs at unbeatable prices.",
    images: [
      {
        url: "/next.svg",
        width: 1200,
        height: 630,
        alt: "Tech AI Monkey - Cheap AI and Super AI",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Tech AI Monkey - Cheap AI & Super AI Assistant",
    description:
      "Cheap AI & super AI assistant: deep web research, continuous learning, coding sandboxes, and fair token pricing.",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": "https://tech-ai.tech/#website",
      "url": "https://tech-ai.tech/",
      "name": "Tech AI Monkey",
      "alternateName": ["Tech AI", "tech-ai.tech", "Cheap AI", "Super AI", "Fair Priced AI"],
      "description": "A fair-priced super AI agent that searches the web and keeps learning."
    },
    {
      "@type": "SoftwareApplication",
      "@id": "https://tech-ai.tech/#application",
      "name": "Tech AI Monkey",
      "applicationCategory": "BusinessApplication",
      "operatingSystem": "Web, Windows, Linux, macOS",
      "offers": {
        "@type": "AggregateOffer",
        "priceCurrency": "EUR",
        "lowPrice": "0",
        "highPrice": "105",
        "offerCount": "4"
      },
      "description": "A powerful cheap AI and super AI agent that performs deep web research, executes code in isolated sandboxes, and learns continuously."
    }
  ]
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        {children}
        <div dangerouslySetInnerHTML={{ __html: `<!-- Default Statcounter code for Tech-ai-agent https:/tech-ai.tech -->
<script type="text/javascript">
var sc_project=13358789;
var sc_invisible=1;
var sc_security="411c5b14";
</script>
<script type="text/javascript" src="https://www.statcounter.com/counter/counter.js" async></script>
<noscript><div class="statcounter"><a title="Web Analytics" href="https://statcounter.com/" target="_blank"><img class="statcounter" src="https://c.statcounter.com/13358789/0/411c5b14/1/" alt="Web Analytics" referrerPolicy="no-referrer-when-downgrade"></a></div></noscript>
<!-- End of Statcounter Code -->` }} />
      </body>
    </html>
  );
}
