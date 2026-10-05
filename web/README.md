# Tech AI monkey (web app)

The consumer web application for **Tech AI monkey** v1.0.0 — a fair-priced AI
with subscriptions, pay-as-you-go tokens, and secure account handling. Built
with **Next.js 16 (App Router, TypeScript, Tailwind)**, **self-hosted** on Linux
and published through a **Cloudflare Tunnel**, with **PostgreSQL** as the database.

## Stack

- **Framework:** Next.js 16 (App Router) + TypeScript
- **Database:** PostgreSQL via Drizzle ORM
- **Auth:** Auth.js v5 (Google, Apple, email/password)
- **Payments:** Stripe (cards + Apple Pay + Google Pay), PayPal, crypto (direct-to-wallet BTC/ETH/BCH)

## Getting started

1. Install Node.js **20+** (24 recommended).

   ```bash
   npm install
   ```

2. Create your environment file and fill in the values (see `.env.example`):

   ```bash
   cp .env.example .env.local
   ```

3. Create the database schema:

   ```bash
   npx drizzle-kit push
   ```

4. Run the app:

   ```bash
   npm run dev
   ```

Open http://localhost:3000.

## Environment variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string (local `postgresql@18-main` in production) |
| `AUTH_SECRET` | Auth.js session secret (`openssl rand -base64 32`) |
| `AUTH_URL` / `NEXT_PUBLIC_APP_URL` | Public base URL — must be `https://tech-ai.tech` in production |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | Google OAuth credentials (login) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth client for **integrations** (falls back to `AUTH_GOOGLE_*`) |
| `SLACK_CLIENT_ID` / `SLACK_CLIENT_SECRET` | Slack app credentials for integrations |
| `EVE_AGENT_URL` / `AGENT_API_KEY_SECRET` | eve agent base URL (`http://127.0.0.1:2000`) + shared API-key secret |
| `AUTH_APPLE_ID` / `AUTH_APPLE_SECRET` | Apple Sign In credentials (optional) |
| `SSN_KEK` | 32-byte base64 master key for SSN encryption (`openssl rand -base64 32`) |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` / `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe |
| `STRIPE_PRICE_PRO` / `STRIPE_PRICE_ULTRA` / `STRIPE_PRICE_BOMB` | Stripe Price IDs for each plan |
| `PAYPAL_CLIENT_ID` / `PAYPAL_CLIENT_SECRET` / `PAYPAL_ENV` | PayPal |
| `CRYPTO_BTC_ADDRESS` / `CRYPTO_ETH_ADDRESS` / `CRYPTO_BCH_ADDRESS` | Business wallets for direct-to-wallet crypto |
| `ETHERSCAN_API_KEY` | On-chain verification for ETH |
| `SUPPORT_EMAIL` / `SUPPORT_WHATSAPP_URL` / `SUPPORT_HOURS` | Customer support contact |
| `COMPANY_NAME` / `ORGANIZATION_NUMBER` | Legal footer data |

## Project structure

```
app/
  (pages)                  landing, signin, signup, pricing, privacy, terms, copyright
  dashboard/               auth-protected dashboard + sidebar, admin, privacy & data
  api/auth/                Auth.js + signup (SSN encryption)
  api/account/export/      GDPR data export (JSON)
  api/integrations/        provider-generic OAuth connect + callback
  api/eve/                 proxies /eve/v1/* to the agent
  api/billing/             Stripe / PayPal / crypto checkout + webhooks
components/                sidebar, chat, subscription manager
lib/
  db/                      Drizzle schema + client
  security/                SSN + token encryption (AES-256-GCM) + Argon2id
  account.ts               delete / export user data
  integrations/            provider registry + OAuth flows
  billing/                 plans, token engine, Stripe, PayPal, crypto
next.config.ts             security headers (HSTS, CSP, …)
```

## Security model

- Passwords hashed with **Argon2id**.
- **SSN** and third-party **tokens** encrypted with AES-256-GCM (per-record key
  wrapped by a master key, `SSN_KEK`, stored outside the database).
- **Security headers** (HSTS, CSP, `X-Content-Type-Options`, `X-Frame-Options`,
  `Referrer-Policy`, `Permissions-Policy`) set in `next.config.ts`.
- **GDPR:** users can export their data (`/api/account/export`) and delete their
  account and all rows from *Dashboard → Privacy & data*.
- TLS via Cloudflare; least-privilege database access.
- **Not yet implemented:** application-level rate limiting (planned as part of
  the CASA work — see `docs/casa-security-plan.md`).

## Pricing (30-day subscriptions)

| Plan | Price | Tokens |
|---|---|---|
| Free | €0 | 40,000 / 5 days |
| PRO | €40 | 250,000 |
| Ultra | €75 | 800,000 |
| Bomb | €105 | 1,200,000 |

Pay-as-you-go: €5–€100 prepaid at €0.00016/token (31,250 tokens per €5).

## Deploy

This app is **self-hosted** on the same machine as the agent and published
through a **Cloudflare Tunnel** (no inbound ports). See the root `README.md`
("Deployment (self-hosted)") and `deploy/` for the systemd units and
`deploy/setup-cloudflare-tunnel.sh`.

```bash
npm run build
sudo systemctl restart myai-web   # or: bash ../deploy/install-services.sh
```

Remember to add the Stripe webhook endpoint (`/api/billing/webhook/stripe`) in
the Stripe dashboard.
