# Tech AI monkey — Project Progress Checkpoint

> Resume point for future sessions. Last updated: 2026-10-05.

## 🟢 LIVE på internett (2026-10-05)

- **https://tech-ai.tech og https://www.tech-ai.tech er LIVE** (HTTP 200 fra 6 land).
- Løsning: **Cloudflare Tunnel** (port 80/443 er stengt utenfra – port-forwarding ville ikke virke).
  - Tunnel: `tech-ai-monkey` (id `d87f4c36-0421-45a4-bae1-6c975e9d4cb8`).
  - Config: `~/.cloudflared/config.yml` → ingress til `http://localhost:3000`.
  - Tjeneste: `cloudflared.service` (enabled, auto-start ved oppstart).
  - Oppsettsskript: `deploy/setup-cloudflare-tunnel.sh` (idempotent — kan kjøres på nytt).
  - **Caddy er slått av** (`systemctl disable --now caddy`) — tunnelen håndterer HTTPS.
- Domenet er registrert hos **one.com**, men navnetjenerne peker til **Cloudflare** (kontoen eier sonen).
- Auth: `NEXT_PUBLIC_APP_URL=https://tech-ai.tech`, `AUTH_URL=https://tech-ai.tech`,
  `trustHost: true` i `web/auth.ts`, og `httpHostHeader: tech-ai.tech` i tunnel-config. ✅
- ⚠️ Husk: Google OAuth redirect URI må inneholde
  `https://tech-ai.tech/api/auth/callback/google` i Google Cloud Console.
  (Feilen `redirect_uri_mismatch` kom av at tunnelen sendte Host=localhost:3000,
  fikset med AUTH_URL + httpHostHeader.)

## Prosjektmappe (flyttet)

- Ny sti: `/run/media/hesriverp7/1CF66753F6672C68/MyGits/Tech-ai-monkey/tech-ai-monkey`
- systemd `myai-agent.service` og `myai-web.service` peker på ny sti.
- Hjelpeskript og `.vscode/tasks.json` er gjort sti-uavhengige.

## What this is

Two projects in one repo:

1. **`/` (root)** — the **AI agent** (eve framework). The "brain": web search,
   learning memory, skills library, chat-history control, API-key issuing.
   Working + validated (`eve info` → 0 errors). Runs on Node 24.

2. **`/web`** — the **consumer web app** (Next.js 16). Accounts, billing,
   subscriptions, dashboard. This is the product users buy.

## Current status — web app

Everything **built and building cleanly** (`tsc` + `next build` pass):

- Landing page (`/`) — now has an **ACTIVE MODEL banner: "Monkey v1 — full AI
  model package, more coming"**.
- Pricing (`/pricing`), Privacy (`/privacy`), Legal/copyright (`/copyright`).
- Sign in (`/signin`) + Sign up (`/signup`) — Google, Apple, email/password.
- Dashboard (`/dashboard/*`) — sidebar, Overview, Artifacts, Workflows,
  Apps to connect, Notebook (reminders), Subscription, Logout.
- Billing APIs: Stripe checkout+webhook, PayPal create/capture, crypto quote/verify.
- Neon Postgres: **live, tables created** (`drizzle-kit push` succeeded).

## Pricing (locked in)

| Plan | Price | Tokens | Period |
|---|---|---|---|
| Free | €0 | 40,000 | 5 days (7-day wait after exhaustion, or pay-as-you-go) |
| PRO | €40 | 250,000 | 30 days |
| Ultra | €75 | 800,000 | 30 days |
| Bomb | **€105** | 1,200,000 | 30 days |

- Pay-as-you-go: €5–€100 prepaid at €0.00016/token (31,250 tokens per €5).
- Upgrade = immediate; downgrade/cancel = stays until period end.

## Legal identity

- **Product:** Tech AI monkey (v1.0.0)
- **Company (copyright owner):** Salazar Rivero Smart Things
- **Org number:** 933 853 195 (Norway) · tax country: Norway

## Support contact

- Email: **support@etch-ai.tech**
- WhatsApp: https://wa.me/4748904267 — hours 12:00–21:00 daily
- Website (planned domain): **tech-ai.tech**

## Payment methods

- Stripe (cards + Apple Pay + Google Pay) — CHECKOUT: `https://tech-ai.tech/api/billing/checkout`,
  WEBHOOK: `https://tech-ai.tech/api/billing/webhook/stripe`
- PayPal (one-time, direct capture — no webhook needed for v1)
- Crypto direct-to-wallet: BTC, ETH, BCH (addresses saved in `.env.local`)

## Environment variables — fill status

File: `web/.env.local` (git-ignored — NEVER commit or share).

FILLED ✅: DATABASE_URL, AUTH_SECRET, SSN_KEK, Stripe publishable key,
PayPal client secret, PayPal env=live, crypto wallet addresses (BTC/ETH/BCH),
support email, org number, company name, model name.

MISSING ⬜ (needed to finish payments):
1. `STRIPE_SECRET_KEY` — user must paste their NEW rotated `sk_live_…`.
2. `STRIPE_WEBHOOK_SECRET` — the `whsec_…` from the Stripe webhook endpoint.
3. `STRIPE_PRICE_PRO/ULTRA/BOMB` — real `price_…` IDs (currently wrong:
   "40 EURO", "75", "105" — amounts, not IDs). Create 3 recurring Prices in
   Stripe: €40 / €75 / €105 per month.
4. `PAYPAL_CLIENT_ID` — user must paste their NEW PayPal client ID.

MISSING ⬜ (optional, for login):
5. `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` — Google Cloud Console OAuth.
6. `AUTH_APPLE_ID` / `AUTH_APPLE_SECRET` — Apple Sign In. Team ID known:
   `DY753XTNPY`. Still need a Services ID + a Key (.p8) from developer.apple.com.

MISSING ⬜ (optional, for on-chain crypto verification):
7. `ETHERSCAN_API_KEY` (ETH), `BLOCKCHAIR_API_KEY` (BCH).

## Apple notes

- Apple Developer account is ACTIVE (cert valid 2026-08-12 → 2027-08-12).
- Developer name: Hollman Enrique Salazar Rivero.
- Team ID: DY753XTNPY.
- Building macOS/iOS apps later requires the user's MacBook Air (2020).

## Google OAuth setup path (for when we resume)

console.cloud.google.com → project "Tech AI monkey" → OAuth consent screen
(External; support email support@etch-ai.tech) → Credentials → OAuth client ID
→ Web application → redirect URIs:
- http://localhost:3000/api/auth/callback/google
- https://tech-ai.tech/api/auth/callback/google

## How to run (local dev)

```bash
cd web
npm install
npx drizzle-kit push        # (only if schema changed)
npm run dev                 # http://localhost:3000
```

Note: eve agent needs Node 24 (run with `npx node@24 node_modules/eve/bin/eve.js dev`).

## Security reminders

- User's old Stripe secret + PayPal secret were pasted in chat → they were told
  to ROTATE them. Confirm new values are in .env.local.
- Never commit `.env.local`. It is git-ignored.
- SSN encrypted AES-256-GCM (KEK in `SSN_KEK`); passwords Argon2id.

## Next steps (in order)

1. Finish Stripe: 3 Prices + secret key + webhook secret.
2. PayPal client ID.
3. Google OAuth (quick, free).
4. Apple Sign In (optional; account active).
5. Deploy to Vercel at tech-ai.tech (add domain + env vars).
6. Wire the eve agent chat into the web dashboard (token metering).
7. Later: desktop apps (Windows/macOS/Linux) + Android/iOS lite versions.

## AI model notes

- Active model (banner): "Monkey v1" — configurable via MODEL_NAME/MODEL_VERSION.
- User has **DeepSeek** (on their Mac, possibly via Ollama). Candidate for the
  agent's model or as one of the "full package" models. DeepSeek is very cheap
  (fits fair pricing). ⚠️ Data-protection consideration: DeepSeek is a Chinese
  provider — for EU user data (incl. SSN) prefer a local/self-hosted DeepSeek or
  a non-Chinese provider for the public chat. Decide when wiring models.
- The eve agent currently defaults to Vercel AI Gateway (openai/gpt-5.5).
