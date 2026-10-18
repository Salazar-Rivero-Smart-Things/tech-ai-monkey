# Tech AI monkey

> **Live:** <https://tech-ai.tech> · **v2.0.0 (Monkey Argon / Qwen 3.8 Hybrid Core)**  
> © Salazar Rivero Smart Things (org. 933 853 195, Norge)

**Tech AI monkey** er en selvlærende, kryssplattform AI-agent (macOS, Linux og Windows) med web-dashboard, terminal-CLI og API.

---

## Pris & Gratis kvote (240 000 gratis hver annen uke)

- **Gratis kvote:** Alle kontoer får **240 000 gratis tokens hver annen uke** automatisk.
- **Rimelig betaling:** Når du trenger mer enn gratiskvoten, må du betale for ekstra bruk eller abonnement — prisene er svært lave og rimelige (støtter kort/Stripe, PayPal og krypto under **Dashboard → Subscription** på <https://tech-ai.tech/pricing>).

---

## API-nøkler (`tai_…`) fra Tech AI monkey-agenten

Du kan få en personlig API-nøkkel (`tai_…`) direkte ved å spørre **tech-ai-monkey**-agenten i chatten:

> *"Gi meg en API-nøkkel"* / *"Give me an API key"*

Eller opprette og administrere nøkler selv under **Dashboard → API keys** (<https://tech-ai.tech/dashboard/api-keys>).

Med denne API-nøkkelen kan du koble til agenten fra dine egne skript, servere, terminalen (CLI) eller kodeeditorer som **VS Code**:

### 1. OpenAI-kompatibelt API (`/v1/chat/completions` & VS Code)

```bash
curl https://tech-ai.tech/v1/chat/completions \
  -H "Authorization: Bearer tai_DIN_API_NOKKEL" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "tech-ai-monkey",
    "messages": [{"role": "user", "content": "Hei! Lag et kryssplattform skript for macOS, Linux og Windows."}],
    "stream": false
  }'
```

- **Modeller:** `GET https://tech-ai.tech/v1/models` (`tech-ai-monkey` – v2.0.0)
- **VS Code-oppsett:** Se <https://tech-ai.tech/docs/vscode>

### 2. Direkte Sesjons-API (`/eve/v1/session`)

```bash
# Start en sesjon
curl -X POST https://tech-ai.tech/eve/v1/session \
  -H "Authorization: Bearer tai_DIN_API_NOKKEL" \
  -H "Content-Type: application/json" \
  -d '{"message": "Hei fra serveren min!"}'
```

### 3. CLI-app for macOS, Linux og Windows

Last ned ferdig installer for **macOS (`.dmg`)**, **Linux (`.deb`)** eller **Windows (`.exe`)** på <https://tech-ai.tech/download>:

```bash
tech-ai login --key tai_DIN_API_NOKKEL
tech-ai ask "Hjelp meg med prosjektet mitt"
tech-ai chat
```

---

## Support

- **E-post:** support@tech-ai.tech
- **Nettside:** <https://tech-ai.tech>
