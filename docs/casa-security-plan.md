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
| **Underleverandørliste + retensjon** i personvernerklæringen | `web/app/privacy/page.tsx` (§5 og §8) |
| **Dataflyt-kart** – data → underleverandører, overføringer utenfor EØS, sletterutiner | [`dataflyt.md`](dataflyt.md) |
| **Nattlig backup + dokumentert gjenoppretting** | `deploy/backup-db.sh`, `deploy/restore-db.sh`, `deploy/myai-backup.{service,timer}`, [`backup-og-gjenoppretting.md`](backup-og-gjenoppretting.md) |
| **Automatisk sårbarhetsovervåking** | `.github/dependabot.yml` (ukesvis, npm rot + web + Actions) og `.github/workflows/security.yml` (`npm audit --omit=dev --audit-level=high` + sjekk for innsjekkede `.env`-filer). **Merk:** GitHub Actions får for tiden ikke starte på repoet — kjøringer feiler med `startup_failure` og `path: BuildFailed`, som betyr at Actions-faktureringen/minuttene på kontoen må ordnes opp i. Workflow-filen er verifisert gyldig (`gh workflow list` viser `security active`), men den kjører ikke før det er på plass. Inntil da dekker `scripts/preflight.sh` de samme sjekkene lokalt. |
| **Hemmeligheter holdes ute av editor-historikk** | `workbench.localHistory.exclude` for `**/.env*` (hindrer at `.env.local`-snapshots havner i VS Code-historikk) |
| **macOS-oppsett (drift)** | [`macos-oppsett.txt`](macos-oppsett.txt) – hva som må flyttes manuelt, og hvorfor |

## Sårbarheter (status 2026-10-05)

Kjørt `npm audit` på begge prosjekter, både med og uten produksjonsavhengigheter:

| Prosjekt | Produksjon (`--omit=dev`) | Alt (inkl. byggeverktøy) |
| --- | --- | --- |
| Agenten (rot) | **0** ✅ | 0 ✅ |
| Web-appen (`web/`) | **0** ✅ | 9 (5 high) — kun `drizzle-kit` |

### Agenten – rettet
`undici` var sårbar i to kopier: `8.9.0` (under `eve`) og `7.29.0` (under
`guarded-fetch` ← `just-bash`). Begge lå i det sårbare spennet
`7.0.0–7.29.0 || 8.0.0–8.10.1`. Den øverste kopien (`7.30.0`) var allerede lappet.

Rettet med målrettede `overrides` i `package.json` i stedet for
`npm audit fix --force` (som ville tvunget en semver-major **nedgradering** av
`just-bash`):

```json
"overrides": {
  "guarded-fetch": "^0.1.5",
  "eve": { "undici": "^8.11.2" }
}
```

Resultat: `guarded-fetch` drar nå `undici@7.30.0`, og `eve`/resten bruker
`undici@8.11.2`. Etterpå ble agenten bygget på nytt og restartet – helse 200,
modell `deepseek-chat`, ingen feil i loggen.

### Web-appen – akseptert, med begrunnelse
Alle 9 funnene ligger i **`drizzle-kit`**, som er et rent **byggeverktøy**
(kjøres bare for `drizzle-kit push`/migrasjoner, aldri i produksjon):

```
drizzle-kit@0.31.11 -> @esbuild-kit/esm-loader@2.6.5
                    -> @esbuild-kit/core-utils@3.3.2
                    -> esbuild@0.18.20
```

- Produksjonsavhengighetene i web-appen har **0** sårbarheter.
- `0.31.11` er **nyeste tilgjengelige** versjon av `drizzle-kit`, så det finnes
  ingen oppgradering som fjerner funnet. Det må i så fall komme fra upstream.
- Advarselen som rammer `esbuild@0.18.20` gjelder **utviklerserveren** til
  esbuild, som kan svare på forespørsler fra vilkårlige nettsteder. `drizzle-kit`
  bruker bare esbuild til å laste `drizzle.config.ts` – den starter ingen
  utviklerserver. Risikoen i vår bruk er derfor i praksis null.
- Tiltak: overvåkes av **Dependabot**, og `npm audit --omit=dev` kjører både lokalt
  (`scripts/preflight.sh`) og i `.github/workflows/security.yml` når GitHub Actions
  kan starte på nytt. Revurderes når `drizzle-kit` bytter bort `@esbuild-kit`.

Verifisert live: headers svarer, `/api/account/export` gir **401** uinnlogget. ✅

---

## Hva som gjenstår (sjekkliste)

### Dokumentasjon vurdereren spør om
- [x] **Datalagrings-/retensjonspolicy** – konkrete frister i `/privacy` §8 og §2 i [`dataflyt.md`](dataflyt.md)
- [x] **Dataflyt-kart** – [`dataflyt.md`](dataflyt.md) (med Mermaid-diagram, rettslig grunnlag og overføringer)
- [x] **Underleverandørliste** – `/privacy` §5 (Cloudflare, Google, Slack, Stripe, PayPal, DeepSeek, Vercel, one.com)
- [ ] **Sikkerhetshendelses-plan** (hvem gjør hva ved brudd, varsling innen 72 t)
- [ ] **Sikker utviklingspraksis** – kodegjennomgang, minste privilegium, hemmeligheter
- [ ] **Kontosletting ved forespørsel** – dokumenter prosessen (e-post → slett innen X dager)

### Tekniske forbedringer som styrker vurderingen
- [ ] **Rate limiting** på login/API (f.eks. Upstash/edge) for å hindre brute force
- [x] **`npm audit` i CI** + automatiske avhengighetsoppdateringer (Dependabot) – se «Sårbarheter» under
- [x] **Backup + gjenoppretting** dokumentert og automatisert (nattlig systemd-timer) – gjenstår å **øve** gjenoppretting kvartalsvis, se [`backup-og-gjenoppretting.md`](backup-og-gjenoppretting.md) §5
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
   Underleverandørliste, retensjon og dataflyt-kart er **ferdige**; sikkerhetshendelses-plan,
   sikker utviklingspraksis og kontoslettingsprosess gjenstår.
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
