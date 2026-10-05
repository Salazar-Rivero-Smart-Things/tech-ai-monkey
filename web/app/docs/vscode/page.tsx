import Link from "next/link";
import CopyBlock from "@/components/copy-block";
import { siteConfig } from "@/lib/site";

export const metadata = {
  title: `Use ${siteConfig.name} in VS Code`,
  description:
    "Add the Tech AI monkey agent as a model in the VS Code chat picker with your own API key, using the built-in Custom Endpoint (BYOK) provider.",
};

// Base URL used in the copy-paste snippets. Override with
// NEXT_PUBLIC_API_BASE_URL if you run your own instance.
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://tech-ai.tech";
const MODEL_ID = "tech-ai-monkey";

const VSCODE_CONFIG = `[
  {
    "name": "Tech AI monkey",
    "vendor": "customendpoint",
    "apiKey": "\${input:techAiKey}",
    "apiType": "chat-completions",
    "models": [
      {
        "id": "${MODEL_ID}",
        "name": "Tech AI monkey",
        "url": "${API_BASE}/v1/chat/completions",
        "toolCalling": false,
        "vision": false,
        "maxInputTokens": 128000,
        "maxOutputTokens": 8192
      }
    ]
  }
]`;

const CURL_MODELS = `curl ${API_BASE}/v1/models \\
  -H "Authorization: Bearer tai_…"`;

const CURL_CHAT = `curl ${API_BASE}/v1/chat/completions \\
  -H "Authorization: Bearer tai_…" \\
  -H "content-type: application/json" \\
  -d '{
    "model": "${MODEL_ID}",
    "messages": [{ "role": "user", "content": "hello" }],
    "stream": false
  }'`;

const CURL_STREAM = `curl -N ${API_BASE}/v1/chat/completions \\
  -H "Authorization: Bearer tai_…" \\
  -H "content-type: application/json" \\
  -d '{
    "model": "${MODEL_ID}",
    "messages": [{ "role": "user", "content": "hello" }],
    "stream": true
  }'`;

function Step({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10">
      <h2 className="flex items-baseline gap-3 text-lg font-semibold text-zinc-100">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-500/15 text-xs font-bold text-blue-300">
          {number}
        </span>
        {title}
      </h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-zinc-300">{children}</div>
    </section>
  );
}

export default function VsCodeDocsPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800 px-6 py-4">
        <Link href="/" className="font-semibold">
          {siteConfig.name}
        </Link>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-3xl font-bold">Use {siteConfig.name} in VS Code</h1>
        <p className="mt-2 text-sm text-zinc-400">
          VS Code can talk to any endpoint that speaks the OpenAI Chat Completions API. This
          instance exposes exactly that, so the same agent you chat with on this site can appear as
          a model in the VS Code model picker — using your own API key, no Copilot plan required.
        </p>

        <div className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/5 p-5 text-sm leading-relaxed text-zinc-300">
          <h2 className="font-semibold text-amber-200">Works in Ask mode, not Agent mode</h2>
          <p className="mt-2">
            The agent runs its own tools (web research, memory, notebooks) on the server, so its
            answers already include that work. VS Code&apos;s <em>Agent</em> mode instead asks the
            model to call <em>VS Code&apos;s</em> tools, which this endpoint does not expose. Keep{" "}
            <code className="rounded bg-zinc-900 px-1.5 py-0.5 text-xs">
              &quot;toolCalling&quot;: false
            </code>{" "}
            and use it in regular chat (Ask). For agentic coding work, keep using a Copilot model.
          </p>
        </div>

        <Step number={1} title="Get an API key">
          <p>
            Open{" "}
            <Link href="/dashboard/api-keys" className="text-blue-400 hover:underline">
              Dashboard → API keys
            </Link>{" "}
            and create a key. It looks like{" "}
            <code className="rounded bg-zinc-900 px-1.5 py-0.5 text-xs">tai_…</code> and is shown
            to you exactly once — copy it straight into VS Code. Only its SHA-256 hash is stored,
            and you can revoke it at any time from the same page.
          </p>
          <p className="text-zinc-400">
            You need to be signed in. Spending goes against your normal token balance; the owner
            account is unlimited.
          </p>
        </Step>

        <Step number={2} title="Add the model in VS Code">
          <ol className="list-inside list-decimal space-y-1.5">
            <li>
              Open the chat model picker in the Chat view and choose{" "}
              <strong>Manage Language Models</strong> (the gear icon) — or run{" "}
              <code className="rounded bg-zinc-900 px-1.5 py-0.5 text-xs">
                Chat: Manage Language Models
              </code>{" "}
              from the Command Palette.
            </li>
            <li>
              Select <strong>Add Models</strong>, then{" "}
              <strong>Custom Endpoint</strong> from the provider list.
            </li>
            <li>
              Enter a group name (for example <em>Tech AI monkey</em>), then paste your{" "}
              <code className="rounded bg-zinc-900 px-1.5 py-0.5 text-xs">tai_…</code> key when
              asked.
            </li>
            <li>
              Pick the API type <strong>Chat Completions</strong>.
            </li>
            <li>
              VS Code opens <code className="rounded bg-zinc-900 px-1.5 py-0.5 text-xs">
                chatLanguageModels.json
              </code>{" "}
              — replace its contents with the block below and save.
            </li>
          </ol>
        </Step>

        <Step number={3} title="Paste the configuration">
          <CopyBlock code={VSCODE_CONFIG} />
          <p className="text-zinc-400">
            The key is referenced as{" "}
            <code className="rounded bg-zinc-900 px-1.5 py-0.5 text-xs">
              {"${input:techAiKey}"}
            </code>{" "}
            so it lives in VS Code&apos;s secret storage instead of sitting in the file as plain
            text. VS Code asks for it the first time the model is used.
          </p>
        </Step>

        <Step number={4} title="Select it in chat">
          <p>
            The model now appears in the model picker as <strong>{siteConfig.name}</strong>. If it
            does not show up straight away, reload the window.
          </p>
        </Step>

        <Step number={5} title="Use it anywhere else">
          <p>
            Nothing here is VS Code specific — any client that lets you set a base URL and an API
            key works, for example Cline, Continue, an SDK, or your own server.
          </p>
          <CopyBlock code={CURL_MODELS} className="mt-3" />
          <CopyBlock code={CURL_CHAT} className="mt-3" />
          <p className="mt-3 text-zinc-400">
            Set{" "}
            <code className="rounded bg-zinc-900 px-1.5 py-0.5 text-xs">
              &quot;stream&quot;: true
            </code>{" "}
            to receive Server-Sent Events exactly as OpenAI sends them:
          </p>
          <CopyBlock code={CURL_STREAM} className="mt-3" />
        </Step>

        <section className="mt-12">
          <h2 className="text-lg font-semibold text-zinc-100">Endpoint reference</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm text-zinc-300">
              <thead className="text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="py-2 pr-4">Method</th>
                  <th className="py-2 pr-4">Path</th>
                  <th className="py-2">Purpose</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                <tr>
                  <td className="py-2 pr-4 font-mono text-xs">GET</td>
                  <td className="py-2 pr-4 font-mono text-xs">/v1/models</td>
                  <td className="py-2">Lists the models you can call</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-mono text-xs">POST</td>
                  <td className="py-2 pr-4 font-mono text-xs">/v1/chat/completions</td>
                  <td className="py-2">
                    Chat Completions, with <code className="text-xs">stream</code> or without
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-sm text-zinc-400">
            Authentication is always{" "}
            <code className="rounded bg-zinc-900 px-1.5 py-0.5 text-xs">
              Authorization: Bearer tai_…
            </code>
            . Errors use OpenAI&apos;s shape:{" "}
            <code className="rounded bg-zinc-900 px-1.5 py-0.5 text-xs">
              {`{ "error": { "message": "…", "type": "…" } }`}
            </code>
            . Status <strong>401</strong> means the key is wrong, revoked or expired;{" "}
            <strong>402</strong> means the account is out of tokens.
          </p>
        </section>

        <section className="mt-12">
          <h2 className="text-lg font-semibold text-zinc-100">Troubleshooting</h2>
          <ul className="mt-3 list-inside list-disc space-y-2 text-sm leading-relaxed text-zinc-300">
            <li>
              <strong>The model is missing from the picker.</strong> Reload VS Code. In Agent mode
              the picker only lists models with tool calling, which is why the configuration sets{" "}
              <code className="rounded bg-zinc-900 px-1.5 py-0.5 text-xs">
                toolCalling: false
              </code>{" "}
              and why it belongs in Ask mode.
            </li>
            <li>
              <strong>401 on every request.</strong> The key was revoked or the whole{" "}
              <code className="rounded bg-zinc-900 px-1.5 py-0.5 text-xs">Authorization</code>{" "}
              header was overridden by a custom{" "}
              <code className="rounded bg-zinc-900 px-1.5 py-0.5 text-xs">requestHeaders</code>{" "}
              entry.
            </li>
            <li>
              <strong>Answers feel like they forget the thread.</strong> Each request is a fresh
              agent session — the full message list is replayed into it. Very long conversations
              get summarised by the client, not by us.
            </li>
            <li>
              <strong>Corporate Copilot policy.</strong> Copilot Business/Enterprise admins can
              disable &ldquo;Bring Your Own Language Model Key in VS Code&rdquo; organisation-wide;
              that setting wins over anything configured locally.
            </li>
          </ul>
        </section>

        <section className="mt-12">
          <h2 className="text-lg font-semibold text-zinc-100">Your data</h2>
          <p className="mt-3 text-sm leading-relaxed text-zinc-300">
            Requests go to this instance using your own key and are metered against your account
            exactly like the web chat and the CLI. What is stored — prompts, replies, retention and
            deletion — is described in the{" "}
            <Link href="/privacy" className="text-blue-400 hover:underline">
              privacy policy
            </Link>
            . Revoking the key in{" "}
            <Link href="/dashboard/api-keys" className="text-blue-400 hover:underline">
              Dashboard → API keys
            </Link>{" "}
            cuts access off immediately.
          </p>
        </section>

        <div className="mt-12 flex flex-wrap gap-4 border-t border-zinc-800 pt-6 text-sm">
          <Link href="/download" className="text-blue-400 hover:underline">
            ← Download the app
          </Link>
          <Link href="/dashboard/api-keys" className="text-blue-400 hover:underline">
            API keys
          </Link>
          <Link href="/privacy" className="text-blue-400 hover:underline">
            Privacy
          </Link>
        </div>
      </main>
    </div>
  );
}
