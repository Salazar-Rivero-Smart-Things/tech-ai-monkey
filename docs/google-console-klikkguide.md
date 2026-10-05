# Klikk-guide: Google Console for Tech AI monkey

Følg stegene i rekkefølge. Under hvert steg står **«Du ser»** (hva som er på
skjermen) og **«Du gjør»** (hva du klikker). Alt gjøres i prosjektet
**`tech-ai-monkey`** (klienten heter **«Tech AI»**).

> Tips: hold denne filen åpen ved siden av nettleseren. Ca. 10 minutter totalt.

## Direkte lenker (lim inn — bytt prosjekt automatisk)

Bruk disse hvis du ikke finner menyvalget:

| Side | Lenke |
| --- | --- |
| Consent screen / Branding | https://console.cloud.google.com/apis/credentials/consent?project=tech-ai-monkey |
| Ny «Google Auth Platform» (oversikt) | https://console.cloud.google.com/auth/overview?project=tech-ai-monkey |
| Audience (Test users) | https://console.cloud.google.com/auth/audience?project=tech-ai-monkey |
| Data Access (scopes) | https://console.cloud.google.com/auth/scopes?project=tech-ai-monkey |
| Verification Center | https://console.cloud.google.com/auth/verification?project=tech-ai-monkey |

> I din Console heter menyvalget **«OAuth consent screen»** (under *APIs &
> Services*). Klikk det — da åpner enten den nye **«Google Auth Platform»**
> (med fanene Branding/Audience/Data Access) eller den klassiske veiviseren.
> Ser du knappen **«Get started»**, klikk den og fyll inn appnavn + e-post +
> **External** — da dukker fanene opp.


---

## Steg 0 — Forberedelser (2 min)

Ha klart:
- **Logo** til appen (kvadratisk PNG/JPG, min. 120×120 px).
- **Support-e-post**: `support@tech-ai.tech`
- **Nettside**: `https://tech-ai.tech`
- **Personvernerklæring**: `https://tech-ai.tech/privacy`
- E-posten du logger inn på Google med (til testbruker).

---

## Steg 1 — Aktiver API-ene (3 × 20 sek)

**Du ser:** venstremenyen med *APIs & Services*.
**Du gjør:**

1. **APIs & Services → Library**
2. Søk opp og trykk **Enable** for hver av disse:
   - **Google Calendar API**
   - **Gmail API**
   - **Google Drive API**

✅ Når alle tre står som «Managed»/«Enabled» er du ferdig her.

---

## Steg 2 — Branding (Merkevare)

**Du ser:** *Google Auth Platform* med fanene **Overview · Branding · Audience ·
Clients · Data Access · Verification Center**.
*(Eldre UI: «OAuth consent screen» med ett langt skjema.)*

**Du gjør:** åpne **Branding** og fyll inn:

| Felt | Verdi |
| --- | --- |
| App name | `Tech AI monkey` |
| User support email | `support@tech-ai.tech` |
| App logo | last opp logoen din |
| Application home page | `https://tech-ai.tech` |
| Privacy policy | `https://tech-ai.tech/privacy` |
| Terms of service | `https://tech-ai.tech/terms` |
| Authorized domains | `tech-ai.tech` |
| Developer contact | din egen e-post |

→ **SAVE**

⚠️ Hvis «Authorized domains» krever verifisering av eierskap: bruk Search
Console/Cloudflare-verifiseringen — men `tech-ai.tech` ligger allerede på
Cloudflare, så det går normalt greit.

---

## Steg 3 — Data Access (scopene)

**Du ser:** fanen **Data Access**.
**Du gjør:** **Add or remove scopes** → legg inn (lim inn én og én / i listen):

```
https://www.googleapis.com/auth/calendar.readonly
https://www.googleapis.com/auth/drive.readonly
https://www.googleapis.com/auth/gmail.readonly
```

(`openid` og `email` er ikke-sensitive og legges ofte til automatisk.)

→ **Update** → **Save**

> Hvis du får «Prepare for verification», trykk deg videre — det gjør vi i steg 5.

---

## Steg 4 — Testbrukere (gjør dette NÅ, så du kan bruke appen i dag) ⭐

**Du ser:** fanen **Audience** (Målgruppe), øverst står
**Publishing status: Testing**.

**Du gjør:**
1. Rull til **Test users** (Testbrukere)
2. **+ Add users** → skriv inn **e-postene** du/de første kundene logger inn med
3. **SAVE**

✅ Nå kan disse koble Google i appen **uten** verifisering. Maks **100** brukere.
Legg gjerne inn din egen e-post først og test med en gang.

---

## Steg 5 — Publiser + be om verifisering (for ALLE kunder)

**Du ser:** fanen **Audience** / **Verification Center**.

**Du gjør:**
1. **Audience → Publish app** → **Confirm**
   (Nå forlater appen «Testing».)
2. **Verification Center → Submit for verification**
3. Lim inn **begrunnelsene** fra
   [`docs/google-oauth-verification.md`](google-oauth-verification.md) — én per scope.
4. Legg ved **demo-video** (YouTube, «unlisted» er greit) som viser:
   innlogging → Connect Google → at AI-en faktisk bruker Calendar/Drive/Gmail.
5. **Submit**.

Google svarer på **support@tech-ai.tech** (sjekk søppelpost). For **Gmail +
Drive** kommer i tillegg en **CASA-sikkerhetsvurdering** — den tar tid.

---

## Etterpå — sjekkliste

- [ ] API-er aktivert (steg 1)
- [ ] Branding lagret (steg 2)
- [ ] Scopes lagt inn (steg 3)
- [ ] Testbrukere lagt inn (steg 4) → **app virker nå for dem**
- [ ] Publisert + sendt verifisering (steg 5)

---

## Feilsøking (hva feilmeldingen betyr)

| Melding | Årsak | Fiks |
| --- | --- | --- |
| `Error 400: redirect_uri_mismatch` | URI ikke registrert på klienten | Legg inn de tre URI-ene fra README |
| `Error 403: access_denied — app has not completed verification` | Testing + ikke testbruker | **Steg 4**, legg inn e-posten |
| `Google hasn't verified this app` (med «Advanced») | App i Testing, verifisering ikke ferdig | **Advanced → Go to tech-ai.tech (unsafe)** |
| `invalid_scope` | Scope mangler i Data Access | **Steg 3** |
| `Google Calendar API has not been used / is disabled` | API ikke aktivert | **Steg 1** |
| `This app is blocked` (Workspace-konto) | Admin-sperre i organisasjonen | Test med en vanlig Gmail-konto |

---

## Hurtigspor (hvis du vil i mål i dag)

Gjør **bare** steg 1, 2, 3 og 4. Da virker Google-integrasjonen for deg og de
første kundene (≤100) mens verifiseringen i steg 5 går sin gang.
