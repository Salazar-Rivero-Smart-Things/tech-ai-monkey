# CASA security assessment — plan for Tech AI monkey

> **Kort:** CASA er Googles påkrevde **årlige sikkerhetsvurdering** for apper som ber
> om *restricted scopes* (her: `gmail.readonly` + `drive.readonly`). Den gjøres av en
> godkjent tredjeparts-vurderer etter [App Defense Alliance](https://appdefensealliance.dev/casa)
> og bygger på **OWASP ASVS**. Bestått → **Letter of Validation (LOV)**.

**Viktig:** CASA er først og fremst en **prosess** (spørreskjema + automatiske skann +
gjennomgang), ikke bare kode. Google Trust & Safety kontakter deg når det er tid.
Nivå (**AL1** eller **AL2**) settes ut fra brukertall, scopes og risiko — og må
fornyes **hvert år**.

---

## Hva appen allerede har ✅

| Krav (ASVS-område) | Status i Tech AI monkey |
| --- | --- |
| Kryptering av sensitive data | ✅ AES-256-GCM envelope-kryptering (`web/lib/security/crypto.ts`), nøkkel i `SSN_KEK` |
| Passord-hashing | ✅ Argon2id (`web/lib/security/password.ts`) |
| Tokens fra tredjepart | ✅ Kryptert før lagring (integrasjoner) |
| Tilgangskontroll | ✅ Alt scopes per `userId` fra sesjon; egen `admin`-rolle |
| Revisjonsspor | ✅ `auditLog`-tabell |
| Transport-sikkerhet | ✅ TLS via Cloudflare (HSTS aktivert, se under) |
| Separasjon av hemmeligheter | ✅ Kun i `.env`/`.env.local` (git-ignorert), aldri i kode |

## Hva jeg la til nå ✅

| Tiltak | Hvor |
| --- | --- |
| **Security headers** (HSTS, CSP, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`) | `web/next.config.ts` |
| **Rett til sletting** – sletter konto + alle rader, logger ut | `web/lib/account.ts` → `deleteUserData()`, `web/app/dashboard/actions.ts` |
| **Brukerflate for GDPR** – «Privacy & data» i sidemenyen | `web/app/dashboard/privacy/page.tsx` (last ned data + slett konto) |
| **Rett til innsyn** – JSON-eksport (uten passord/tokens) | `web/app/api/account/export/route.ts` |

Verifisert live: headers svarer, `/api/account/export` gir **401** uinnlogget. ✅

---

## Hva som gjenstår (sjekkliste)

### Dokumentasjon vurdereren spør om
- [ ] **Datalagrings-/retensjonspolicy** – hvor lenge lagrer vi hva, og hvorfor
- [ ] **Dataflyt-kart** – hvilke data går til hvilke underleverandører
- [ ] **Underleverandørliste** – Google, Slack, Stripe, PayPal, DeepSeek, Cloudflare, one.com
- [ ] **Sikkerhetshendelses-plan** (hvem gjør hva ved brudd, varsling innen 72 t)
- [ ] **Sikker utviklingspraksis** – kodegjennomgang, minste privilegium, hemmeligheter
- [ ] **Kontosletting ved forespørsel** – dokumenter prosessen (e-post → slett innen X dager)

### Tekniske forbedringer som styrker vurderingen
- [ ] **Rate limiting** på login/API (f.eks. Upstash/edge) for å hindre brute force
- [ ] **`npm audit` i CI** + automatiske avhengighetsoppdateringer (Dependabot)
- [ ] **Backup + gjenoppretting** dokumentert (Postgres-dump) og testet
- [ ] **Minimumsbredde på CSP** – vurder å fjerne `unsafe-inline` (krever nonce)
- [ ] **Sesjons-håndtering** – korte levetider, `Secure`/`HttpOnly`/`SameSite` (NextAuth-standard: OK)
- [ ] **DAST** – kjør en automatisk skanner (OWASP ZAP) mot en staging-URL og fiks funn

### Organisatorisk
- [ ] **MFA** på alle admin-kontoer (Google, Cloudflare, Postgres)
- [ ] **Tilgangsstyring** – hvem har tilgang til serveren/DB/hemmeligheter
- [ ] **Årlig fornyelse** – sett påminnelse; nivået kan øke med brukertallet

---

## Forslag til rekkefølge

1. Skriv de fem dokumentene over (policyer) — CASA-spørreskjemaet følger ASVS-kapitler.
2. Kjør `npm audit` og en ZAP-skan mot staging; fiks det som kommer.
3. Når Google inviterer deg: velg vurderer, bruk **CASA Accelerator** hvis du har
   andre sertifiseringer (ISO 27001/SOC 2) — det sparer deg for mye.
4. Få **LOV** → publiser for alle kunder.
5. Sett påminnelse om **fornyelse om 12 måneder**.

---

## Nyttige lenker

- CASA: <https://appdefensealliance.dev/casa>
- CASA-krav: <https://appdefensealliance.dev/casa/casa-requirements>
- Nivåer (AL1/AL2): <https://appdefensealliance.dev/casa/casa-tiering>
- Googles verifiseringskrav: <https://support.google.com/cloud/answer/13464321>
