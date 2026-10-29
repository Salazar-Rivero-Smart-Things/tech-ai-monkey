# Tech AI monkey

> **Live:** <https://tech-ai.tech> · **v2.0.1 (tech-ai.tech monkey v2.0.1 / 100 % lokal Ollama-motor)**  
> © Salazar Rivero Smart Things (org. 933 853 195, Norge)

**Tech AI monkey v2.0.1** er en 100 % selvstendig, selvlærende, kryssplattform AI-agent (macOS, Linux og Windows) som kjører på egen lokal **Ollama**-motor med kontinuerlig API-nøkkelrotasjon, web-dashboard, terminal-CLI, PHP/HTML-kodebygger og OpenAI/Ollama-kompatibelt API.

---

## Bilder, video, kode (.php / .html) og dokumenter — og AI-lagde bilder

Du trenger ikke beskrive filen din med ord. Trykk på **+** ved meldingsfeltet i chatten
(<https://tech-ai.tech/dashboard/chat>), velg filen, skriv gjerne et spørsmål — og agenten
ser på innholdet selv og forklarer hva den finner. Én fil per melding, opptil **200 MB**.

| Du laster opp | Agenten gjør | Formater |
|---|---|---|
| **Bilde** | Ser på bildet og forklarer hva som er på det: figurer, farger, tekst, skjermbilder, feilmeldinger, diagrammer. | `.png` `.jpg` `.jpeg` `.webp` `.gif` |
| **Video** | Analyserer videoen med **FFmpeg**: henter ut stillbilder gjennom hele klippet og leser av tekniske data (lengde, oppløsning, bildefrekvens). Du får en forklaring på hva som skjer — skjermopptak, demoer, feilsituasjoner. | `.mp4` `.m4v` `.mov` `.avi` `.mkv` `.webm` `.wmv` `.mpg` `.mpeg` `.3gp` `.ogv` `.ts` `.mts` `.m2ts` |
| **Dokument & Kode** | Leser teksten/koden og svarer på innholdet, eller bygger komplette PHP- og HTML-nettsider som kan lastes ned som `index.php` / `index.html`. | `.php` `.html` `.css` `.js` `.ts` `.json` `.sql` `.txt` `.md` `.markdown` `.rtf` `.doc` `.docx` `.pdf` |

Eksempler du kan skrive rett inn:

- *«Lag en komplett PHP web-fil (index.php) med kontaktskjema og validering.»*
- *«Hva står det i dette skjermbildet?»* + et bilde
- *«Se på denne videoen og fortell hva som går galt.»* + en `.mp4`
- *«Oppsummer dette dokumentet i tre punkter.»* + en `.docx`

### AI-genererte bilder

Agenten kan også **lage bilder selv**. Bare spør i chatten:

> *«Lag et bilde av en rosa katt som sitter på en server rack.»*

Bildet lages av agenten, lagres på serveren og vises direkte i samtalen — klart til å lastes ned.
Uten egen API-nøkkel brukes en gratis bildetjeneste; vil du holde promptene private kan du peke
agenten mot din egen leverandør med `IMAGE_GEN_BASE_URL`, `IMAGE_GEN_API_KEY` og `IMAGE_GEN_MODEL`
(se [.env.example](./.env.example)).

---

## Pris & Gratis kvote (240 000 gratis hver annen uke)

- **Gratis kvote:** Alle kontoer får **240 000 gratis tokens hver annen uke** automatisk.
- **Rimelig betaling:** Når du trenger mer enn gratiskvoten, må du betale for ekstra bruk eller abonnement — prisene er svært lave og rimelige (støtter kort/Stripe, PayPal og krypto under **Dashboard → Subscription** på <https://tech-ai.tech/pricing>).

---

## API-nøkler (`tai_…`) fra Tech AI monkey-agenten

Du kan få en personlig API-nøkkel (`tai_…`) direkte ved å spørre **tech-ai-monkey**-agenten i chatten:

> *"Gi meg en API-nøkkel"* / *"Give me an API key"*

Eller opprette og administrere nøkler selv under **Dashboard → API keys** (<https://tech-ai.tech/dashboard/api-keys>).

Med denne API-nøkkelen kan du koble til agenten fra dine egne skript, servere, terminalen (CLI), lokal Ollama eller kodeeditorer som **VS Code**:

### 1. Ollama- & OpenAI-kompatibelt API (`/v1/chat/completions` & VS Code)

```bash
curl https://tech-ai.tech/v1/chat/completions \
  -H "Authorization: Bearer tai_DIN_API_NOKKEL" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "tech-ai-monkey",
    "messages": [{"role": "user", "content": "Hei! Lag en komplett index.php med kontaktskjema."}],
    "stream": false
  }'
```

- **Modeller:** `GET https://tech-ai.tech/v1/models` (`tech-ai-monkey` – v2.0.1)
- **VS Code-oppsett:** Se <https://tech-ai.tech/docs/vscode>
- **Last ned Ollama & CLI:** Se <https://tech-ai.tech/download>

### 2. Direkte Sesjons-API (`/eve/v1/session`)

```bash
# Start en sesjon
curl -X POST https://tech-ai.tech/eve/v1/session \
  -H "Authorization: Bearer tai_DIN_API_NOKKEL" \
  -H "Content-Type: application/json" \
  -d '{"message": "Hei fra serveren min!"}'
```

### 3. Lokal Ollama-motor (`tech-ai-monkey` v2.0.1) & kontinuerlig nøkkelrotasjon

**Tech AI monkey v2.0.1** kjører 100 % selvstendig på egen lokal **Ollama**-motor uten eksterne OpenAI/DeepSeek-avhengigheter:

```bash
# Bygg den lokale modellen fra Modelfile.tech-ai-monkey
ollama create tech-ai-monkey -f Modelfile.tech-ai-monkey

# Test modellen lokalt
ollama run tech-ai-monkey
```

- **Kontinuerlig API-nøkkelrotasjon & selvhelbredelse:** `agent/lib/ollama-auth.ts` og `agent/lib/supervisor.ts` roterer den interne nøkkelen (`sk-ollama-live-…`) automatisk hvert 10. minutt, komprimerer systemprompten for lynrask respons (1–3 s til første ord), og holder Ollama-modellen varm i minnet (`keep_alive: "24h"`).
- **PHP & HTML kodebygger:** Spør agenten om å lage `.php`- eller `.html`-filer, og last dem ned direkte som `index.php` eller `index.html` med ett klikk i chatten.

### 4. CLI-app for macOS, Linux og Windows

Last ned ferdig installer for **macOS (`.dmg`)**, **Linux (`.deb`)** eller **Windows (`.exe`)** på <https://tech-ai.tech/download>:

```bash
tech-ai login --key tai_DIN_API_NOKKEL
tech-ai ask "Lag en komplett index.php med kontaktskjema"
tech-ai chat
```

---

## Support

- **E-post:** support@tech-ai.tech
- **Nettside:** <https://tech-ai.tech>
- **GitHub:** <https://github.com/Salazar-Rivero-Smart-Things/tech-ai-monkey>

