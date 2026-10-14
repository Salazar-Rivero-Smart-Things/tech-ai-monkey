import Link from "next/link";
import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { siteConfig } from "@/lib/site";

export const dynamic = "force-dynamic";

interface Artifact {
  name: string;
  bytes: number;
}

function downloadsDir() {
  return join(process.cwd(), "public", "downloads");
}

function humanSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

async function listArtifacts(): Promise<Artifact[]> {
  try {
    const entries = await readdir(downloadsDir());
    const found: Artifact[] = [];
    for (const name of entries) {
      if (!/\.(deb|exe|msi|pkg|dmg)$/i.test(name)) continue;
      const info = await stat(join(downloadsDir(), name));
      found.push({ name, bytes: info.size });
    }
    return found.sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}

async function readChecksums(): Promise<Record<string, string>> {
  try {
    const text = await readFile(join(downloadsDir(), "checksums.txt"), "utf8");
    const map: Record<string, string> = {};
    for (const line of text.split("\n")) {
      const match = line.trim().match(/^([0-9a-f]{64})\s+\*?(.+)$/i);
      if (match) map[match[2]] = match[1];
    }
    return map;
  } catch {
    return {};
  }
}

function DownloadCard({
  title,
  subtitle,
  artifact,
  checksum,
  command,
  comingSoon = false,
  note,
  extra,
}: {
  title: string;
  subtitle: string;
  artifact?: Artifact;
  checksum?: string;
  command: string;
  comingSoon?: boolean;
  note?: string;
  extra?: string;
}) {
  if (comingSoon) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-700 bg-zinc-900/20 p-6">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold text-zinc-300">{title}</h2>
          <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-300">
            Coming soon
          </span>
        </div>
        <p className="mt-1 text-sm text-zinc-400">{subtitle}</p>
        {note && (
          <p className="mt-4 rounded-md border border-zinc-800 bg-black/30 px-3 py-2 text-sm text-zinc-400">
            {note}
          </p>
        )}
        <pre className="mt-4 overflow-x-auto rounded-md border border-zinc-800 bg-black/50 p-3 font-mono text-xs text-zinc-400">
          {command}
        </pre>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-zinc-400">{subtitle}</p>

      {artifact ? (
        <>
          <a
            href={`/downloads/${artifact.name}`}
            download
            className="mt-4 inline-block rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
          >
            Download {humanSize(artifact.bytes)}
          </a>
          <p className="mt-2 font-mono text-xs text-zinc-500">{artifact.name}</p>
          {checksum && (
            <p className="mt-3 break-all font-mono text-[11px] leading-relaxed text-zinc-600">
              SHA-256 {checksum}
            </p>
          )}
          {extra && <p className="mt-2 text-xs text-zinc-500">{extra}</p>}
          <pre className="mt-4 overflow-x-auto rounded-md border border-zinc-800 bg-black/50 p-3 font-mono text-xs text-zinc-300">
            {command}
          </pre>
        </>
      ) : (
        <p className="mt-4 rounded-md border border-zinc-800 bg-black/30 px-3 py-2 text-sm text-zinc-400">
          Not built yet. Run <code className="text-zinc-200">bash scripts/build-cli.sh</code> on the
          server to produce this file.
        </p>
      )}
    </div>
  );
}

export default async function DownloadPage() {
  const [artifacts, checksums] = await Promise.all([listArtifacts(), readChecksums()]);
  const deb = artifacts.find((a) => a.name.endsWith(".deb"));
  // Prefer the installer for Windows: it is what gives the Start-menu entry.
  const winSetup = artifacts.find((a) => /_setup\.exe$/i.test(a.name));
  const winPortable = artifacts.find((a) => a.name.endsWith(".exe") && a !== winSetup);
  const exe = winSetup ?? winPortable;
  const mac = artifacts.find((a) => a.name.endsWith(".pkg") || a.name.endsWith(".dmg"));
  const macDmg = mac?.name.endsWith(".dmg") ?? false;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800 px-6 py-4">
        <Link href="/" className="font-semibold">
          {siteConfig.name}
        </Link>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-12">
        <h1 className="text-3xl font-bold">Download the app</h1>
        <p className="mt-2 text-sm text-zinc-400">
          The {siteConfig.name} command-line app talks to the same agent as the website. Sign in
          once, then ask from any terminal.
        </p>

        <div className="mt-8 grid gap-6 md:grid-cols-3">
          <DownloadCard
            title="Ubuntu / Debian"
            subtitle="64-bit .deb package for Ubuntu 20.04 and newer, and Debian 11 and newer"
            artifact={deb}
            checksum={deb ? checksums[deb.name] : undefined}
            command={`sudo dpkg -i ${deb?.name ?? "tech-ai_<version>_amd64.deb"}
tech-ai login
tech-ai ask "hello"`}
          />
          <DownloadCard
            title="Windows"
            subtitle={
              winSetup
                ? "Installer for Windows 10 and 11 — adds “Tech AI monkey” to the Start menu"
                : "Standalone 64-bit .exe for Windows 10 and 11"
            }
            artifact={exe}
            checksum={exe ? checksums[exe.name] : undefined}
            command={
              winSetup
                ? `# double-click to install, then open a new terminal:
tech-ai login
tech-ai ask "hello"`
                : `# double-click the .exe, or from PowerShell:
.\\${exe?.name ?? "tech-ai_<version>_windows_x64.exe"} login
tech-ai ask "hello"`
            }
            extra={
              winSetup && winPortable
                ? `Prefer no installer? There is also a portable single file: ${winPortable.name}`
                : undefined
            }
          />
          <DownloadCard
            title="macOS"
            subtitle={
              mac
                ? macDmg
                  ? "Universal DMG for Apple Silicon (M1 and newer), macOS Sequoia 15.7.9 or newer"
                  : "Installer for Apple Silicon (M1 and newer), macOS Sequoia 15.7.9 or newer"
                : "Apple Silicon (M1 and newer), macOS Sequoia 15.7.9 or newer"
            }
            artifact={mac}
            checksum={mac ? checksums[mac.name] : undefined}
            comingSoon={!mac}
            extra={
              macDmg
                ? "Open the downloaded disk image in Finder and follow the installation instructions inside."
                : undefined
            }
            command={
              mac
                ? macDmg
                  ? `# Open the disk image in Finder:
open "${mac.name}"

# Then sign in and use the CLI:
tech-ai login
tech-ai ask "hello"`
                  : `# Install the package, then sign in:
sudo installer -pkg "${mac.name}" -target /
tech-ai login
tech-ai ask "hello"`
                : `# not available yet — see below for how to run it
# from source with Node.js 18+ meanwhile`
            }
          />
        </div>

        <section className="mt-12">
          <h2 className="text-lg font-semibold text-zinc-100">What you can install it on</h2>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">
            The Linux and Windows downloads are self-contained — the runtime is bundled, so you do{" "}
            <strong>not</strong> need to install Node.js, Python or anything else first. 64-bit
            systems only.
          </p>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-5">
              <h3 className="font-semibold text-zinc-100">
                Linux — <span className="font-mono text-xs text-zinc-400">.deb</span>
              </h3>
              <ul className="mt-3 space-y-2 text-sm leading-relaxed text-zinc-400">
                <li>
                  <span className="text-zinc-200">Architecture:</span> 64-bit x86 (amd64 / x86-64)
                </li>
                <li>
                  <span className="text-zinc-200">Ubuntu:</span> 20.04 LTS and newer — 22.04, 24.04,
                  26.04 — desktop and server
                </li>
                <li>
                  <span className="text-zinc-200">Debian:</span> 11 (bullseye) and newer — 12, 13
                </li>
                <li>
                  <span className="text-zinc-200">Also works on:</span> Linux Mint 20+, Pop!_OS
                  20.04+, Zorin OS 16+, elementary OS 6+, Kali 2021+, MX Linux 21+, Devuan 4+ and
                  Parrot OS
                </li>
                <li>
                  <span className="text-zinc-200">Requires:</span> libc6 2.17 or newer — a bare
                  minimum, so the package also installs on older releases such as Debian 10 and
                  Ubuntu 18.04, even though we only test on the versions listed above
                </li>
                <li>
                  <span className="text-zinc-200">Menu entry:</span> on a desktop install you also
                  get “Tech AI monkey” in the application menu, which opens a terminal running
                  tech-ai chat
                </li>
                <li>
                  <span className="text-zinc-200">Not supported:</span> 32-bit (i386), ARM64 /
                  Raspberry Pi, Alpine and other musl-based distros, and RPM distros such as Fedora,
                  RHEL and openSUSE
                </li>
              </ul>
              <pre className="mt-4 overflow-x-auto rounded-md border border-zinc-800 bg-black/50 p-3 font-mono text-xs text-zinc-300">{`sudo dpkg -i ${deb?.name ?? "tech-ai_<version>_amd64.deb"}
sudo apt-get install -f       # only if dpkg reports a missing dependency

sudo apt-get remove tech-ai   # uninstall`}</pre>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-5">
              <h3 className="font-semibold text-zinc-100">
                Windows — <span className="font-mono text-xs text-zinc-400">.exe</span>
              </h3>
              <ul className="mt-3 space-y-2 text-sm leading-relaxed text-zinc-400">
                <li>
                  <span className="text-zinc-200">Architecture:</span> 64-bit x86 (x64)
                </li>
                <li>
                  <span className="text-zinc-200">Windows:</span> Windows 10 (all 64-bit editions)
                  and Windows 11
                </li>
                <li>
                  <span className="text-zinc-200">Server:</span> Windows Server 2019 and newer
                </li>
                <li>
                  <span className="text-zinc-200">Installer:</span> no admin rights needed. It
                  installs into your own user folder, adds “Tech AI monkey” to the Start menu with
                  the app icon, optionally a desktop shortcut, puts <code>tech-ai</code> on your
                  PATH, and registers an uninstaller under Apps &amp; features
                </li>
                <li>
                  <span className="text-zinc-200">Portable:</span> the single .exe runs anywhere
                  with no installation — but then there is no Start-menu entry, and the file
                  carries the default Windows icon rather than the app icon
                </li>
                <li>
                  <span className="text-zinc-200">Not supported:</span> 32-bit Windows, Windows on
                  ARM (ARM64), Windows 7 / 8 / 8.1
                </li>
              </ul>
              <pre className="mt-4 overflow-x-auto rounded-md border border-zinc-800 bg-black/50 p-3 font-mono text-xs text-zinc-300">{`# Windows may show "Windows protected your PC":
#   More info  ->  Run anyway
# (the file is not code-signed yet)

# to uninstall, just delete the .exe`}</pre>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-5">
              <h3 className="font-semibold text-zinc-100">
                macOS — <span className="font-mono text-xs text-zinc-400">.dmg</span>
              </h3>
              <ul className="mt-3 space-y-2 text-sm leading-relaxed text-zinc-400">
                <li>
                  <span className="text-zinc-200">Architecture:</span> Universal build for Apple
                  Silicon (M1, M2, M3 and M4)
                </li>
                <li>
                  <span className="text-zinc-200">macOS:</span> Sequoia 15.7.9 and newer
                </li>
                <li>
                  <span className="text-zinc-200">Install:</span> open the downloaded DMG in Finder
                  and follow the instructions inside
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900/30 p-5 text-sm leading-relaxed text-zinc-400">
            <h3 className="font-semibold text-zinc-100">Servers without a desktop</h3>
            <p className="mt-2">
              <code className="rounded bg-zinc-900 px-1.5 py-0.5 text-xs">tech-ai login</code> opens
              a browser, so on a headless server sign in with an API key or with e-mail + password
              instead. Both work fine over SSH:
            </p>
            <pre className="mt-3 overflow-x-auto rounded-md border border-zinc-800 bg-black/50 p-3 font-mono text-xs text-zinc-300">{`tech-ai login --key tai_…                              # key from Dashboard → API keys
tech-ai login --email you@example.com --password '…'`}</pre>
          </div>

          {!mac && (
            <div className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/5 p-5 text-sm leading-relaxed text-zinc-300">
              <h3 className="font-semibold text-amber-200">macOS download unavailable</h3>
              <p className="mt-2">
                The macOS download is not currently present. When available, the supported release
                targets Apple Silicon (M1 and newer) and macOS Sequoia 15.7.9 or newer.
              </p>
              <p className="mt-2">
                You can still use the same agent in the{" "}
                <Link href="/dashboard/chat" className="text-blue-400 hover:underline">
                  web app
                </Link>
                , or run the CLI from source with Node.js 18+ installed:
              </p>
              <pre className="mt-3 overflow-x-auto rounded-md border border-zinc-800 bg-black/50 p-3 font-mono text-xs text-zinc-300">{`git clone https://github.com/Salazar-Rivero-Smart-Things/tech-ai-monkey.git
cd tech-ai-monkey
node cli/src/index.js login
node cli/src/index.js ask "hello"`}</pre>
            </div>
          )}
        </section>

        <section className="mt-12 space-y-6 text-sm leading-relaxed text-zinc-300">
          <div>
            <h2 className="text-lg font-semibold text-zinc-100">Three ways to sign in</h2>
            <pre className="mt-3 overflow-x-auto rounded-md border border-zinc-800 bg-black/50 p-4 font-mono text-xs text-zinc-300">{`tech-ai login                            # opens your browser — Google or e-mail
tech-ai login --email you@example.com --password '…'
tech-ai login --key tai_…                # key from Dashboard → API keys`}</pre>
            <p className="mt-3">
              The token is stored locally in{" "}
              <code className="rounded bg-zinc-900 px-1.5 py-0.5 text-xs">
                ~/.config/tech-ai/credentials.json
              </code>{" "}
              with file mode 600. Revoke it any time under{" "}
              <Link href="/dashboard/api-keys" className="text-blue-400 hover:underline">
                Dashboard → API keys
              </Link>
              .
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-zinc-100">What you can do</h2>
            <pre className="mt-3 overflow-x-auto rounded-md border border-zinc-800 bg-black/50 p-4 font-mono text-xs text-zinc-300">{`tech-ai ask "why does my Next.js build fail?"
tech-ai ask --session <id> "follow up in the same conversation"
tech-ai chat          # interactive session, /exit to quit
tech-ai whoami        # account + how many tokens are left`}</pre>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-zinc-100">Use it inside VS Code</h2>
            <p className="mt-2">
              The same account also works as a model in the VS Code chat picker: add it as a{" "}
              <em>Custom Endpoint</em> with an API key and it shows up next to the Copilot models.
              No Copilot plan required for that. The{" "}
              <Link href="/docs/vscode" className="text-blue-400 hover:underline">
                VS Code guide
              </Link>{" "}
              has the three-step setup and a configuration block you can paste straight in.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-zinc-100">Verify the download</h2>
            <p className="mt-2">
              Compare the SHA-256 shown above with the file you received, or check{" "}
              <a
                href="/downloads/checksums.txt"
                className="text-blue-400 hover:underline"
                download
              >
                checksums.txt
              </a>
              :
            </p>
            <pre className="mt-3 overflow-x-auto rounded-md border border-zinc-800 bg-black/50 p-4 font-mono text-xs text-zinc-300">{`sha256sum ${deb?.name ?? "tech-ai_<version>_amd64.deb"}     # Linux
certutil -hashfile ${exe?.name ?? "tech-ai_<version>_windows_x64.exe"} SHA256   # Windows
shasum -a 256 ${mac?.name ?? "tech-ai_<version>_macos_universal.dmg"}  # macOS`}</pre>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-zinc-100">Building it yourself</h2>
            <p className="mt-2">
              The CLI is plain Node.js with zero dependencies and lives in{" "}
              <code className="rounded bg-zinc-900 px-1.5 py-0.5 text-xs">cli/</code>. Build the
              installers with{" "}
              <code className="rounded bg-zinc-900 px-1.5 py-0.5 text-xs">
                bash scripts/build-cli.sh
              </code>
              , or run it straight from source:
            </p>
            <pre className="mt-3 overflow-x-auto rounded-md border border-zinc-800 bg-black/50 p-4 font-mono text-xs text-zinc-300">{`node cli/src/index.js help`}</pre>
          </div>
        </section>
      </main>
    </div>
  );
}
