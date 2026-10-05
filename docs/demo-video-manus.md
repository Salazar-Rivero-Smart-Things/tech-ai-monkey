# Demo-video for Google-verifisering — manus

Google krever en kort video som viser **hvordan appen bruker hvert scope**.
Reviewerne er internasjonale → **snakk engelsk** (eller ha engelsk tekst på skjermen).

- **Lengde:** 1–2 minutter er nok
- **Last opp:** YouTube, sett til **Unlisted** (ikke Private — da kan ikke reviewer se den)
- **Viktig:** ikke vis passord, tokens eller API-nøkler

---

## Opptakssjekkliste (vis disse)

- [ ] Nettleserens adressefelt viser **`tech-ai.tech`** (matcher navnet i consent-skjermen)
- [ ] Innlogging med Google (viser at appen bruker kontoen)
- [ ] **Consent-skjermen med scopene listet** — Calendar/Drive/Gmail må være synlige
- [ ] **«Apps to connect» → Connect Google services**
- [ ] Selve **bruken**, ett eksempel per scope (under)

---

## Manus (engelsk tale)

**0:00 — Intro**
> "This is Tech AI monkey, an AI assistant at tech-ai.tech."

**0:10 — Innlogging**
> "I sign in with my Google account."
*(vis Google-innlogging)*

**0:20 — Koble til Google**
> "From Apps to connect, I connect my Google services."
*(vis `Dashboard → Apps to connect → Connect Google services`)*

**0:30 — Consent-skjermen (viktig!)**
> "Here Google shows exactly which permissions we request: read-only access to
> Calendar, Drive and Gmail. I accept."
*(hold på skjermen så scopene er lesbare i noen sekunder)*

**0:45 — Calendar (calendar.readonly)**
Til AI-en i chatten:
> "What's on my calendar tomorrow?"
*(vis svaret som leser kalenderen)*

**1:00 — Gmail (gmail.readonly)**
> "Summarise the latest email in my inbox."
*(vis sammendraget)*

**1:15 — Drive (drive.readonly)**
> "Find my file named 'project plan' and summarise it."
*(vis at den leser filen)*

**1:30 — Personvern + avslutning**
> "We never send, edit or delete anything — access is read-only, and the user can
> disconnect at any time from the dashboard. Privacy policy is at tech-ai.tech/privacy."
*(vis Privacy-siden kort)*

---

## Etter opptaket

1. Last opp til YouTube → **Unlisted** → kopier lenken
2. **Verification Center → Submit** og lim inn lenken
3. Referer til begrunnelsene i [`google-oauth-verification.md`](google-oauth-verification.md)

> Tips: hvis du ikke vil vise ekte e-post/kalender, lag et **test-Google-akonto**
> med noen få oppføringer og bruk den i videoen.
