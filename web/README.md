# Tech AI monkey (web app)

The consumer web application for **Tech AI monkey** v1.0.0 — a fair-priced AI
with subscriptions, pay-as-you-go tokens, and secure account handling. Built
with **Next.js 16 (App Router, TypeScript, Tailwind)** and deployed on
**Vercel**, with **Neon Postgres** as the database.

## Stack

- **Framework:** Next.js 16 (App Router) + TypeScript
- **Database:** Neon Postgres via Drizzle ORM
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
| `DATABASE_URL` | Neon Postgres connection string |
| `AUTH_SECRET` | Auth.js session secret (`openssl rand -base64 32`) |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | Google OAuth credentials |
| `AUTH_APPLE_ID` / `AUTH_APPLE_SECRET` | Apple Sign In credentials |
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
  (pages)                  landing, signin, signup, pricing, privacy, copyright
  dashboard/               auth-protected dashboard + sidebar
  api/auth/                Auth.js + signup (SSN encryption)
  api/billing/             Stripe / PayPal / crypto checkout + webhooks
components/                sidebar, subscription manager
lib/
  db/                      Drizzle schema + client
  security/                SSN envelope encryption + Argon2id
  billing/                 plans, token engine, Stripe, PayPal, crypto
```

## Security model

- Passwords hashed with **Argon2id**.
- **SSN** encrypted with AES-256-GCM using a per-record key wrapped by a master
  key (KEK) stored outside the database; stored in a separate table, masked in
  UI, never logged.
- TLS 1.3 + HSTS, rate limiting, and least-privilege database access.

## Pricing (30-day subscriptions)

| Plan | Price | Tokens |
|---|---|---|
| Free | €0 | 40,000 / 5 days |
| PRO | €40 | 250,000 |
| Ultra | €75 | 800,000 |
| Bomb | €105 | 1,200,000 |

Pay-as-you-go: €5–€100 prepaid at €0.00016/token (31,250 tokens per €5).

## Deploy

```bash
vercel
```

Set all environment variables in the Vercel project settings, then add the
Stripe webhook endpoint (`/api/billing/webhook/stripe`) in the Stripe dashboard.
