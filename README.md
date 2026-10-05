# Tech AI monkey

> **Live:** <https://tech-ai.tech> · **v1.0.0**
> © Salazar Rivero Smart Things (org. 933 853 195, Norge)

A durable, self-improving AI agent built on [eve](https://eve.dev), with a full
Next.js web app (dashboard, authentication, billing) in front of it. It is
**self-hosted** on a single Linux machine and published to the internet through a
**Cloudflare Tunnel** (no inbound ports required).

The agent:

- **Searches the whole web** until it finds the issue or fix (`web_search` +
  `web_fetch`, guided by the `deep-web-research` skill).
- **Keeps learning** between conversations via cross-session memory.
- **Has a library** of reusable skills under `agent/skills/`.
- **Deletes chat history** on request (Clear / Reset).
- **Issues API keys** so your server can talk to it over HTTP.

The web app (`web/`) adds:

- A **dashboard** with chat, notebooks, workflows, artifacts and apps.
- **Authentication** (Google + email/password) via NextAuth.
- **Billing** (Stripe, PayPal, crypto) with token-based plans.

## Architecture

```
Internet → Cloudflare (tech-ai.tech, HTTPS)
         → Cloudflare Tunnel (cloudflared)
         → Next.js web app  (web/,  port 3000)
         → /eve/v1/* proxy  (web/app/eve/v1/[...path]/route.ts)
         → eve agent        (port 2000)
         → DeepSeek API     (deepseek-chat)
```

The chat in `web/components/chat.tsx` talks to the eve agent over
`/eve/v1/session`, which `web/app/eve/v1/[...path]/route.ts` proxies to the
agent with auth + token billing.

Ports: **web 3000**, **agent 2000**. Postgres runs locally
(`postgresql@18-main`).

## Model

The agent's model is chosen in `agent/agent.ts`:

- **Preferred — `deepseek-chat`** (DeepSeek V3) via the OpenAI-compatible
  `https://api.deepseek.com/v1` endpoint. Enabled by setting `DEEPSEEK_API_KEY`
  in the root `.env`.
- **Fallback — `poolside/laguna-s-2.1-free`** through the Vercel AI Gateway
  (needs no paid credits) when no DeepSeek key is set.

```ts
model: deepseek ?? "poolside/laguna-s-2.1-free",
```

To use a different provider, change the model helper/id in `agent/agent.ts`.

## Requirements

- **Node.js 24+** (`eve` requires it)
- **PostgreSQL 18** (local, `postgresql@18-main`)
- **cloudflared** — only needed to publish the site publicly

## Setup

### 1. The agent (root)

```bash
npm install

cp .env.example .env
# edit .env:
#   AGENT_API_KEY_SECRET=$(openssl rand -hex 32)   # shared secret for API keys
#   EVE_PUBLIC_URL=http://127.0.0.1:2000
#   DEEPSEEK_API_KEY=sk-...                        # optional; falls back to AI Gateway

npm run dev          # dev server at http://127.0.0.1:2000

# production:
npm run build        # -> .output/
npm run start        # serves the built agent on PORT (default 2000)
```

### 2. The web app (`web/`)

```bash
cd web
npm install

# Configure .env.local with at least:
#   DATABASE_URL=postgres://...
#   AUTH_SECRET=<openssl rand -hex 32>
#   AUTH_URL=https://tech-ai.tech            # base URL (must match the public host)
#   NEXT_PUBLIC_APP_URL=https://tech-ai.tech
#   EVE_AGENT_URL=http://127.0.0.1:2000
#   AGENT_API_KEY_SECRET=<same secret as the agent>
#   plus Google OAuth, Stripe/PayPal/crypto keys for auth & billing

npx drizzle-kit push    # create/update database tables
npm run dev             # http://localhost:3000

# production:
npm run build
npm run start           # serves the built app on PORT=3000
```

Open <http://localhost:3000>.

## Ask the agent

- Web app: open <http://localhost:3000/dashboard/chat> (sign in first).
- Built-in web chat: open <http://127.0.0.1:2000/> (no key needed in local dev).
- Terminal UI: type in the `npm run dev` session.

Ask it things like:

- "Find out why my Next.js build fails with error X and give me the fix."
- "Give me an API key for my Node server."
- "Delete this chat history."

## Hook up your server (HTTP API)

The agent exposes the eve HTTP API. Locally the base URL is
`http://127.0.0.1:2000`; in production it is `https://tech-ai.tech` (the web app
proxies `/eve/v1/*` to the agent). Every route requires
`Authorization: Bearer <apiKey>`.

```bash
# 1) Get a key from the agent ("give me an API key"), then:

# Create a session and send the first message
curl -X POST http://127.0.0.1:2000/eve/v1/session \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"message":"Hello"}'

# Continue the session
curl -X POST http://127.0.0.1:2000/eve/v1/session/<sessionId> \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"message":"Follow up"}'

# Stream the reply (NDJSON)
curl http://127.0.0.1:2000/eve/v1/session/<sessionId>/stream \
  -H "Authorization: Bearer $API_KEY"
```

### Session control (delete history)

| Action        | Endpoint                                       |
| ------------- | ---------------------------------------------- |
| Clear history | `POST /eve/v1/session/:sessionId/clear`        |
| Delete/reset  | `POST /eve/v1/session/:sessionId/reset`        |
| Cancel turn   | `POST /eve/v1/session/:sessionId/cancel`       |

## OpenAI-compatible API (VS Code and friends)

The web app also serves an OpenAI-compatible Chat Completions API on the same
host, so the agent can be used as a model in VS Code and any other tool that
lets you set a base URL and a key. Authentication is the same `tai_…` key from
**Dashboard → API keys** (`Authorization: Bearer tai_…`), and the same token
metering applies — the owner account is unlimited.

| Method | Path                     | Purpose                                          |
| ------ | ------------------------ | ------------------------------------------------ |
| `GET`  | `/v1/models`             | Lists the models you can call (`tech-ai-monkey`)  |
| `POST` | `/v1/chat/completions`   | Chat Completions, with `stream: true` or `false`  |

```bash
curl https://tech-ai.tech/v1/chat/completions \
  -H "Authorization: Bearer tai_…" \
  -H "content-type: application/json" \
  -d '{"model":"tech-ai-monkey","messages":[{"role":"user","content":"hi"}],"stream":false}'
```

Errors use OpenAI's shape (`{"error":{"message":…,"type":…}}`): `401` for a
bad or revoked key, `402` when the account is out of tokens. The customer-facing
walkthrough lives at **https://tech-ai.tech/docs/vscode** (`web/app/docs/vscode`),
and the agent itself is instructed to link that page plus
`https://tech-ai.tech/dashboard/api-keys` whenever anyone asks where to get a key.

Implementation notes:

- `web/app/v1/chat/completions/route.ts` flattens the OpenAI `messages` array into
  the single prompt the eve agent accepts, creates a fresh session per request,
  and translates the agent's event stream into `chat.completion.chunk` SSE.
- `web/lib/api-caller.ts` resolves the caller from either the browser session
  cookie or `Authorization: Bearer tai_…`, and both `/eve/v1/*` and `/v1/*` use it.
- Configure the model with `"toolCalling": false`: the agent runs its own tools
  server-side, so it belongs in VS Code's **Ask** mode. Agent mode expects the
  model to call the editor's tools, which this endpoint does not expose.

## CLI app (Linux & Windows)

`cli/` is a dependency-free Node client that talks to the agent with the user's
own account (or an API key). The installers are built on the server and served
by the web app out of `web/public/downloads/`:

```bash
bash scripts/build-cli.sh                          # -> .deb + .exe + checksums.txt
(cd web && npm run build)                          # then restart so /download picks them up
sudo systemctl restart myai-web
```

> **Gotcha:** Next.js maps `public/` when the service starts, so **any** new file
> dropped into `web/public/downloads/` returns 404 until `myai-web` is restarted.
> The `/download` page is dynamic and finds the file immediately — so you can end
> up with a button that works but a download that 404s. Always restart after copying.

`https://tech-ai.tech/download` lists whatever is present, with SHA-256 sums and
the full system requirements.

| Installer | Runs on |
| --- | --- |
| `tech-ai_<version>_amd64.deb` | Ubuntu 20.04 LTS+ and Debian 11+ (64-bit x86; the package only needs `libc6 >= 2.17`). Adds a “Tech AI monkey” entry to the application menu |
| `tech-ai_<version>_windows_x64_setup.exe` | Windows 10, Windows 11, Windows Server 2019+ (64-bit x86). Per-user install, Start-menu entry with the app icon, optional desktop shortcut, PATH entry and an uninstaller |
| `tech-ai_<version>_windows_x64.exe` | The same agent as a portable single file, no installation — but no Start-menu entry and the default Windows icon |
| macOS | **not built yet** — needs Apple code-signing + notarisation (planned for macOS 12+, Apple Silicon and Intel) |

All three carry the same icon: `cli/assets/icon.svg` plus `.png`, `.ico` and `.icns`, all
produced from one source of truth by `python3 scripts/make-icons.py`.

The Windows installer is cross-built on Linux by `makensis` (no emulation layer involved).
Because bun can only attach an icon to a `.exe` when bun itself runs on Windows, the
shortcut icon comes from the installer rather than from the executable.

Both are self-contained: the runtime is bundled, so no Node.js or other
dependency has to be installed on the target machine.

```bash
sudo dpkg -i tech-ai_1.0.0_amd64.deb   # Linux install
tech-ai login                          # browser, or --email/--password, or --key tai_…
tech-ai ask "why does my Next.js build fail?"
tech-ai whoami
```

Credentials live in `~/.config/tech-ai/credentials.json` (file mode 600) and can
be revoked at any time under **Dashboard → API keys**.

## Integrations ("Apps to connect")

Users connect third-party apps from **`/dashboard/apps`**. Each provider is
defined in `web/lib/integrations/providers.ts`; the OAuth flow is:

```
/dashboard/apps  →  /api/integrations/<provider>/connect
                 →  provider consent screen
                 →  /api/integrations/<provider>/callback   (exchange code, store tokens)
```

Tokens are stored **encrypted** (AES-256-GCM envelope, KEK = `SECRET_KEK`).

Ready providers: **Slack**, **Google services** (Calendar + Drive + Gmail,
read-only), **Google Workspace** (Gmail + Drive + Calendar, read-only).

> Google verification is a project of its own — see
> [`docs/google-oauth-verification.md`](docs/google-oauth-verification.md) for a
> ready-to-use checklist, scope justifications and a cheaper launch option, and
> [`docs/google-console-klikkguide.md`](docs/google-console-klikkguide.md) for a
> screen-by-screen click guide (Norwegian).

### Redirect URIs to register with each provider

| Provider | Redirect URI |
| --- | --- |
| Google (login) | `https://tech-ai.tech/api/auth/callback/google` |
| Google services | `https://tech-ai.tech/api/integrations/google/callback` |
| Google Workspace | `https://tech-ai.tech/api/integrations/google_workspace/callback` |
| Slack | `https://tech-ai.tech/api/integrations/slack/callback` |

Credentials live in `web/.env.local`:

- Google: `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`
  (falls back to `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` — same client is fine).
- Slack: `SLACK_CLIENT_ID` / `SLACK_CLIENT_SECRET`
  (redirect URL is set in the Slack app, not Google).

> **Next.js gotcha:** `NEXT_PUBLIC_APP_URL` is baked in **at build time**. After
> changing it you must rebuild (`cd web && npm run build`), not just restart.

### ⚠️ Google verification status (important before selling)

The consent screen is **published (In production)**, but our scopes are not
approved yet. Google's **OAuth user cap** therefore applies: **100 users**,
counted over the project's lifetime, and it **cannot be reset**.

What customers experience right now:

- They see Google's **“unverified app”** screen.
- They can continue via **Advanced → Go to tech-ai.tech (unsafe)** and connect.
- `/dashboard/apps` explains this and gives them the support route: email
  **support@tech-ai.tech** with (1) that they are a new customer, (2) the email
  they registered on tech-ai.tech and (3) the Google account they want to connect
  (only if it differs from the registered one). We approve them manually.

> **Do not press “Back to testing”** — Testing restricts access to listed test
> users, while production + the 100-user cap lets real customers self-serve.

| Scopes | Class | Required for unrestricted public use |
| --- | --- | --- |
| `openid`, `email` | non-sensitive | nothing |
| `calendar.readonly` | **sensitive** | Google OAuth verification |
| `gmail.readonly`, `drive.readonly` | **restricted** | verification **+ annual CASA security assessment** |

Cheapest path first:

1. **Drop the restricted scopes** (Gmail/Drive) if not needed → only Calendar
   remains and CASA is avoided (edit `scopes` in `providers.ts`).
2. **Complete verification** (*Verification Center → Submit*) → warning and cap
   disappear. Google then contacts you about **CASA**
   ([`docs/casa-security-plan.md`](docs/casa-security-plan.md)).
3. Serve the first **≤ 100** customers under the cap meanwhile.
4. **Google Workspace organisations** can use a service account with
   domain-wide delegation instead of per-user consent.

Guides: [`docs/google-oauth-verification.md`](docs/google-oauth-verification.md)
(checklist + scope justifications),
[`docs/google-console-klikkguide.md`](docs/google-console-klikkguide.md)
(click guide, Norwegian) and
[`docs/demo-video-manus.md`](docs/demo-video-manus.md) (demo-video script).

### Adding a new provider ("other apps")

The connect/callback routes are provider-generic, so adding an app is config only:

1. Add an entry to `PROVIDERS` in `web/lib/integrations/providers.ts`
   (`id`, `name`, `description`, `clientIdEnv`, `clientSecretEnv`, endpoints,
   `scopes`, `scopeSeparator`, optional `extraAuthParams`).
2. Add the credentials to `web/.env.local`.
3. Register `https://tech-ai.tech/api/integrations/<id>/callback` with the provider.
4. Restart the web app — the card appears automatically on `/dashboard/apps`
   (the page is driven by `PROVIDER_IDS`). No other code changes needed.

## Security & privacy

- **Encryption at rest:** third-party tokens (Google, Slack, …) use AES-256-GCM
  envelope encryption with a KEK from the environment (`SECRET_KEK`, legacy name
  `SSN_KEK`); passwords use Argon2id.
- **No social security numbers:** the signup form does not ask for fødselsnummer
  and there is no table or field for it, so the Service does not process any
  GDPR Article 9 (special category) data.
- **Security headers** (HSTS, CSP, `X-Content-Type-Options`, `X-Frame-Options`,
  `Referrer-Policy`, `Permissions-Policy`) are set in `web/next.config.ts`.
- **Right of access:** signed-in users can download everything we store via
  `GET /api/account/export` (never password hashes or tokens).
- **Right to erasure:** *Dashboard → Privacy & data* deletes the account and
  every related row (`web/lib/account.ts`), then signs the user out.
- **Audit trail:** account and integration events are recorded in `auditLog`.
- **Sub-processors & retention:** the full list (Cloudflare, Google, Slack, Stripe, PayPal,
  DeepSeek, Vercel, one.com) and concrete retention periods are published in
  [`/privacy`](https://tech-ai.tech/privacy) (§5 and §8).
- **Data-flow map:** what data goes where, legal basis, transfers outside the EEA and
  deletion routines — [`docs/dataflyt.md`](docs/dataflyt.md).
- **Backups:** a nightly `pg_dump` (systemd timer) with a documented, tested restore path —
  [`docs/backup-og-gjenoppretting.md`](docs/backup-og-gjenoppretting.md).
- **Google / CASA:** annual security-assessment plan and checklist in
  [`docs/casa-security-plan.md`](docs/casa-security-plan.md).

## Backup & recovery

Customer data lives in the local PostgreSQL database, so it is backed up nightly:

```bash
bash deploy/backup-db.sh       # manual run  -> ~/backups/tech-ai-monkey/daily/
bash deploy/install-backup.sh  # installs the nightly systemd timer (03:30)
bash deploy/restore-db.sh <fil.sql.gz>   # restore (takes a safety backup first)
```

- Keeps **30 daily** dumps and **12 monthly** copies; older ones are pruned automatically.
- Dumps are written with mode `600` in a `700` directory and are **never** committed to git.
- `BACKUP_DIR` can point at another disk (e.g. a NAS) via `deploy/backup.env`.
- Full runbook (verify, restore from scratch, troubleshooting):
  [`docs/backup-og-gjenoppretting.md`](docs/backup-og-gjenoppretting.md).

> ⚠️ `SECRET_KEK` is **not** part of the dump. Store it separately and securely — without it the
> encrypted connected-app tokens in a restored database cannot be decrypted, and every
> customer has to reconnect Google/Slack.

## Owner access (unlimited)

The instance owner is **never metered and never blocked** — no token counter and no
402 "out of tokens". That applies to the dashboard, the HTTP API and the CLI alike,
on every machine the owner signs in from, because it is tied to the account and not
to a device.

`web/lib/entitlements.ts` decides it. An account is unlimited when **either**:

- its `role` is `admin` (the first account ever created is promoted automatically), **or**
- its email is listed in `OWNER_EMAILS` in `web/.env.local` (comma-separated,
  case-insensitive).

Set `OWNER_EMAILS` in addition to the role, so owner access survives even if the
role is ever lost:

```
OWNER_EMAILS=you@example.com
```

Verify: *Dashboard → Subscription* shows **Unlimited**, or `tech-ai whoami` replies
`Unlimited — owner account, never metered`.

## Tests before you push

`scripts/preflight.sh` runs 66 checks and tells you whether it is safe to push:

```bash
bash scripts/preflight.sh
```

It verifies the systemd services, every database table, the owner/unlimited path
end-to-end (it inserts a temporary CLI token, checks it, then deletes it again),
all public and dashboard routes, that the APIs reject unauthenticated callers, the
download files byte-for-byte, the installed CLI binary, the security headers, the
live site through Cloudflare, and a secret scan of what would be pushed.

## Project layout

```
.github/
  dependabot.yml              # weekly npm + GitHub Actions updates
  workflows/security.yml      # npm audit on production deps + tracked-.env check
agent/
  agent.ts                    # model config (DeepSeek / AI Gateway fallback)
  instructions.md             # system prompt / operating rules
  channels/eve.ts             # HTTP API auth (API keys)
  channels/home.ts            # serves the web chat UI at /
  instructions/memory.ts      # cross-session learning instructions
  lib/jwt.ts                  # API-key minting helper
  lib/memory-store.ts         # cross-session memory storage
  tools/issue_api_key.ts      # "give me an API key"
  tools/delete_chat_history.ts# "delete my history"
  tools/remember.ts           # "remember this"
  tools/forget.ts             # "forget this"
  tools/list_memories.ts      # "what do you remember?"
  skills/                     # reusable skills (deep-web-research, self-improvement…)
public/index.html             # built-in web chat UI
cli/                          # terminal client (bundled into the .deb / .exe)
  src/index.js                # command parsing (login, ask, chat, whoami)
  src/login.js                # browser / e-mail+password / API-key sign-in
  src/api.js                  # eve HTTP client
  src/config.js               # ~/.config/tech-ai/credentials.json (mode 600)
scripts/build-cli.sh          # builds the .deb + .exe into web/public/downloads/
web/
  app/download/               # public download page (links + system requirements)
  app/cli-login/              # browser handoff for "tech-ai login"
  app/dashboard/api-keys/     # create/revoke CLI + server API keys
  app/                        # Next.js pages + API routes (auth, billing, eve proxy)
  app/dashboard/privacy/      # GDPR: download data + delete account
  app/api/account/export/     # GDPR: JSON data export
  components/chat.tsx         # dashboard chat (talks to the agent)
  components/sidebar.tsx      # dashboard nav (incl. Support link)
  lib/account.ts              # delete/export user data (shared by UI + API)
  lib/                        # auth, billing, db, security, integrations
  next.config.ts              # security headers (HSTS, CSP, …)
docs/
  google-oauth-verification.md   # verification checklist + scope justifications
  google-console-klikkguide.md   # screen-by-screen click guide (Norwegian)
  demo-video-manus.md            # demo-video script for Google
  casa-security-plan.md          # CASA / ASVS plan, status and checklist
  dataflyt.md                    # data-flow map (sub-processors, transfers, retention)
  backup-og-gjenoppretting.md    # backup/restore runbook (Norwegian)
  macos-oppsett.txt              # setting up the whole project on a Mac (Norwegian)
  macos-bygg-cli.txt             # build + sign + notarise the macOS CLI (Norwegian)
deploy/
  install-services.sh         # install/refresh the systemd services
  myai-agent.service          # agent unit (port 2000)
  myai-web.service            # web unit (port 3000)
  setup-db.sh                 # database setup
  setup-cloudflare-tunnel.sh  # publish tech-ai.tech via Cloudflare Tunnel
  Caddyfile                   # legacy (Caddy is disabled; the tunnel handles HTTPS)
  backup-db.sh                # nightly pg_dump -> gzip (30 d + 12 mnd)
  restore-db.sh               # restore a dump (safety backup first)
  myai-backup.service         # oneshot backup unit
  myai-backup.timer           # runs it nightly at 03:30
  install-backup.sh           # installs + enables the timer
  backup.env.example          # optional backup overrides (dir, retention)
```

## Deployment (self-hosted)

The site runs on this machine as three systemd services:

| Service               | Purpose                          |
| --------------------- | -------------------------------- |
| `myai-agent.service`  | eve agent (port 2000)            |
| `myai-web.service`    | Next.js web app (port 3000)      |
| `cloudflared.service` | Cloudflare Tunnel → tech-ai.tech |
| `myai-backup.timer`   | nightly PostgreSQL backup (03:30)|

```bash
# 1) Build both apps
npm run build            # agent -> .output/
(cd web && npm run build)

# 2) Install/refresh the systemd services (asks for sudo)
bash deploy/install-services.sh

# 3) Publish the domain (one-time Cloudflare login, then idempotent)
bash deploy/setup-cloudflare-tunnel.sh

# 4) Enable the nightly database backup (asks for sudo)
bash deploy/install-backup.sh
```

Notes:

- `AGENT_API_KEY_SECRET` must be set (in `.env`) or API-key auth fails closed
  (no external access).
- `AUTH_URL` and `NEXT_PUBLIC_APP_URL` must be `https://tech-ai.tech`, otherwise
  OAuth redirects break behind the tunnel.
- The Google OAuth client (used for **login and** integrations) must list these
  authorized redirect URIs:
  `https://tech-ai.tech/api/auth/callback/google`,
  `https://tech-ai.tech/api/integrations/google/callback`,
  `https://tech-ai.tech/api/integrations/google_workspace/callback`.
  (Slack has its own redirect URL, set in the Slack app config.)
- Keep all `.env*` files out of git (they are git-ignored).

### Support

- Email: **support@tech-ai.tech**
- WhatsApp: <https://wa.me/4748904267> (12:00–21:00 daily)
- In-app: **Support** link in the dashboard sidebar (pre-filled email).

**Google-access requests (while verification is pending):** ask the customer to
email support from their registered address with (1) that they are a new
customer, (2) their tech-ai.tech account email and (3) the Google account they
want to connect (only if it differs). Then either add them as a **Test user** or
rely on the 100-user cap and tell them to use *Advanced → Continue*.
