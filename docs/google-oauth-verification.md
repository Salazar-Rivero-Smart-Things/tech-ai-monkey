# Google OAuth verification — checklist for Tech AI monkey

Goal: let **any** customer connect Google (Calendar / Drive / Gmail) without the
`403: access_denied — app has not completed Google verification` error.

> While the OAuth consent screen is in **Testing**, only ≤ 100 **Test users** can
> connect. Publishing is not enough on its own for Gmail/Drive.

## What we request, and how Google classifies it

| Scope | Class | What Google requires for public use |
| --- | --- | --- |
| `openid`, `email` | non-sensitive | nothing |
| `calendar.readonly` | **sensitive** | OAuth verification (free, ~1–3 weeks) |
| `drive.readonly` | **restricted** | verification **+ security assessment (CASA)** |
| `gmail.readonly` | **restricted** | verification **+ security assessment (CASA)** |

Because we ask for **Drive + Gmail**, the app needs **verification + a CASA
security assessment** before it can be used by arbitrary accounts.

## Required artifacts (prepare these first)

- [ ] Public **privacy policy** — https://tech-ai.tech/privacy
- [ ] Public **homepage** — https://tech-ai.tech
- [ ] **App name**, logo, support email (`support@tech-ai.tech`) in *Branding*
- [ ] **Authorized domains**: `tech-ai.tech`
- [ ] **Redirect URIs** registered (see main README)
- [ ] A short **demo video** (YouTube, *unlisted* is fine) showing: sign-in →
      connect Google → the feature that uses Calendar/Drive/Gmail.
      Script ready in [`demo-video-manus.md`](demo-video-manus.md).
- [ ] **Scope justifications** (below)

## Scope justification texts (paste into the verification form)

**`calendar.readonly`**
> Tech AI monkey reads the user's Google Calendar (read-only) so the assistant
> can answer questions about upcoming events and prepare the user for meetings.
> Data is used only to render this information in the user's dashboard and is
> never sold or shared. Users can disconnect at any time from the dashboard.

**`drive.readonly`**
> The assistant reads files the user has chosen to make available in Google
> Drive (read-only) so it can answer questions about their own documents. We do
> not modify, create, or delete files, and we do not access files the user has
> not connected.

**`gmail.readonly`**
> The assistant reads the user's Gmail (read-only) to summarise and search their
> own email when they ask. We never send, modify, or delete mail, and messages
> are processed only to answer the user's request.

## Steps

1. **OAuth consent screen → Publish app** (moves out of *Testing*).
2. Fill **Branding**, **Audience**, **Data access**; add the three scopes with
   the justifications above.
3. Submit for **verification** (Google emails you; answer their questions).
4. Google will trigger the **CASA / security assessment** for the restricted
   scopes — budget time and possibly cost.
5. Meanwhile: keep the app in **Testing** and add early customers under
   **Test users** (≤ 100). *(Note: publishing removes the Testing cap, but until
   verification is complete, unverified users may still be blocked for the
   restricted scopes.)*

## Cheaper alternative (recommended for a fast launch)

Drop the two restricted scopes and ship **Calendar only** first:

```ts
// web/lib/integrations/providers.ts  → google.scopes
scopes: ["openid", "email", "https://www.googleapis.com/auth/calendar.readonly"],
```

Then you only need OAuth verification for one **sensitive** scope (far lighter,
no CASA). Add Drive/Gmail later behind a verified release.

## Other providers

Only Google imposes this verification burden. Slack (and most others) let you
ship an install link without Google-style verification. Adding a provider is
configuration-only — see “Adding a new provider” in the main README.
