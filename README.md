# Tech AI monkey

> **Live:** <https://tech-ai.tech> · **v2.1 (`tech-ai.tech monkey v2.1` — 100 % lokal AI-motor via `llama.cpp` / `llama-server`)**  
> © Salazar Rivero Smart Things (org. 933 853 195, Norge)

**Tech AI monkey v2.1** er en 100 % selvstendig, selvlærende og kryssplattform AI-applikasjon (Windows, macOS og Linux) som kjører på sin egen oppdaterte GPU-motor (llama.cpp / Qwen 2.5 Coder) på vår dedikerte server. Den er **helt uavhengig av eksterne leverandører som OpenAI og DeepSeek**, og krever **ingen lokal modellinstallasjon eller Ollama** fra sluttbrukeren. Alt du trenger er å laste ned CLI-appen eller bruke web-dashboardet.

---

## 🚀 Slik bruker du Tech AI monkey CLI

Du kan laste ned den ferdige CLI-appen direkte fra **<https://tech-ai.tech/download>** eller fra **[GitHub Releases](https://github.com/Salazar-Rivero-Smart-Things/tech-ai-monkey/releases)**.

### 1. Windows (`.exe` / `.zip`)
1. **Last ned:** Hent `tech-ai.exe` (eller `tech-ai_2.1.0_windows_x64.zip` og pakk den ut).
2. **Åpne terminal:** Åpne PowerShell, CMD eller Windows Terminal i mappen der `tech-ai.exe` ligger.
3. **Logg inn:**
   ```powershell
   .\tech-ai.exe login
   ```
   *Dette åpner nettleseren din automatisk på <https://tech-ai.tech/signin> hvor du logger inn med e-post og passord.*  
   *Har du en API-nøkkel fra før kan du også kjøre: `.\tech-ai.exe login --key tai_DIN_NOKKEL`*
4. **Start å bruke agenten:**
   ```powershell
   # Start interaktiv samtale:
   .\tech-ai.exe chat

   # Eller still et raskt engangsspørsmål:
   .\tech-ai.exe ask "Hvordan optimaliserer jeg denne SQL-spørringen?"

   # Sjekk konto og gjenværende tokens:
   .\tech-ai.exe whoami
   ```
   *(Tips: Legg mappen til i din Windows PATH hvis du vil skrive bare `tech-ai` fra alle mapper).*

---

### 2. macOS (`.dmg`)
1. **Last ned:** Hent `tech-ai_2.1.0_macos_universal.dmg` fra <https://tech-ai.tech/download>.
2. **Installer:** Åpne `.dmg`-filen i Finder og følg instruksjonene for å legge den i `/usr/local/bin` eller Programmer.
3. **Logg inn og kjør:**
   ```bash
   tech-ai login
   tech-ai chat
   ```

---

### 3. Linux (Ubuntu / Debian `.deb`)
1. **Last ned:** Hent `tech-ai_2.1.0_amd64.deb` fra <https://tech-ai.tech/download>.
2. **Installer:**
   ```bash
   sudo dpkg -i tech-ai_2.1.0_amd64.deb
   ```
3. **Kjør:**
   ```bash
   tech-ai login
   tech-ai chat
   ```

---

## 🛠️ CLI Kommandooversikt

| Kommando | Beskrivelse |
|---|---|
| `tech-ai login` | Logger inn via nettleseren på tech-ai.tech (e-post og passord). |
| `tech-ai login --key <nøkkel>` | Logger inn direkte med personlig API-nøkkel (`tai_...`). |
| `tech-ai chat` | Starter en interaktiv terminal-chat med minne mellom turene. |
| `tech-ai ask "<tekst>"` | Sender ett spørsmål og skriver ut svaret direkte i terminalen. |
| `tech-ai whoami` | Viser innlogget e-post, kvote og gjenværende tokens. |
| `tech-ai logout` | Fjerner lagrede innloggingsdata fra maskinen din. |
| `tech-ai --local` | Kobler direkte til en lokal utviklingsserver (`http://127.0.0.1:3100`). |

Inne i `tech-ai chat` kan du bruke:
- `/new` – Starter en helt fersk samtale (nullstiller kontekst).
- `/exit` eller `/quit` – Avslutter chatten.

---

## Oversikt over porter og tjenester

Alle tjenester kjører lokalt bundet til `127.0.0.1` og eksponeres kun utad gjennom Cloudflare-tunnelen til <https://tech-ai.tech>:

| Tjeneste | Port | Beskrivelse |
|---|---|---|
| **PostgreSQL** | `5432` | Database for brukere, API-nøkler, kvoter og abonnementer (`127.0.0.1:5432`) |
| **Lokal AI-motor (`llama-server`)** | `8080` | GPU-akselerert `llama.cpp`-server (`http://127.0.0.1:8080/v1`, f.eks. Qwen 2.5 Coder 7B GGUF) |
| **AI Agent (`myai-agent` / Eve)** | `2000` | Selve AI-agenten (`eve start --host 127.0.0.1 --port 2000`) med sandkasse, minne, ferdigheter og verktøy |
| **Web-app (`myai-web` / Next.js)** | `3100` | Nettside, innlogging, dashboard, API-proxy og nedlastingsside (`next start -H 127.0.0.1 -p 3100`) |
| **Cloudflare Tunnel (`cloudflared`)** | HTTPS → `3100` | Ruter `https://tech-ai.tech` og `https://www.tech-ai.tech` til `http://127.0.0.1:3100` |

---

## 💻 Kjøre lokalt på egen utviklermaskin (Fullstack)

Vil du kjøre hele Tech AI Monkey-økosystemet (database, GPU-motor, agent og webserver) på din egen PC med Windows og NVIDIA GPU:

### 1. Hurtigstart på Windows
Kjør det medfølgende startscriptet som håndterer alle avhengigheter, helsesjekker og porter automatisk:
```cmd
start-tech-ai-monkey.bat
```
Dette starter:
1. **PostgreSQL** på port `5432` (rent oppsett via `pg_ctl`).
2. **llama-server** på port `8080` med Qwen 2.5 Coder akselerert på GPU (RTX).
3. **AI Agent** på port `2000`.
4. **Web App** på port `3100` (<http://localhost:3100>).

For å stoppe alt rent igjen:
```cmd
stop-tech-ai-monkey.bat
```

Du kan også starte kun modellserveren separat med:
```cmd
scripts\start-llama-server.bat
```

---

## 📦 Bygge CLI-installasjonsfiler selv

CLI-en ligger i mappen `cli/` og har null eksterne produksjonsavhengigheter:

- **Bygg Windows `.exe`:**
  Kjør scriptet på Windows:
  ```cmd
  scripts\build-cli.bat
  ```
  Dette produserer en lynrask frittstående `tech-ai.exe` og `tech-ai_2.1.0_windows_x64.zip` i `web/public/downloads/`.
- **Bygg Linux `.deb` og macOS `.dmg`:**
  På Linux eller Mac kjører du:
  ```bash
  # macOS universal DMG (Apple Silicon arm64 + Intel x86_64):
  bash scripts/build-dmg.sh

  # Linux .deb:
  bash scripts/build-cli.sh --linux-only
  ```

---

## 🖼️ Bilder, video, kode (.php / .html) og dokumenter

I chatten på webdashbordet (<https://tech-ai.tech/dashboard/chat>) kan du trykke på **+** for å laste opp filer (opptil 200 MB per fil):
- **Bilder:** Analyserer innhold, figurer, tekst, diagrammer og feilmeldinger (`.png`, `.jpg`, `.webp`, osv.).
- **Video:** Analyserer video med FFmpeg og forklarer hva som foregår.
- **Kode og dokumenter:** Genererer komplette PHP- og HTML-nettsider, analyserer kode, eller oppsummerer PDF/Word-dokumenter.
- **AI-bildegenerering:** Be agenten generere bilder direkte i chatten (f.eks. *"Lag et bilde av en robot i et serverrom"*).

---

## 💰 Pris og gratis kvote (240 000 tokens gratis)

- **Gratis kvote:** Alle nye kontoer får **240 000 gratis tokens hver annen uke** automatisk.
- **Rimelig oppgradering:** Trenger du mer kapasitet, tilbyr vi svært rimelig påfyll og abonnementer under **Dashboard → Subscription** på <https://tech-ai.tech/pricing> (støtter kort/Stripe, PayPal, Vipps nr. **139973** og krypto).

---

## 🔌 API & VS Code Integrasjon

Du kan hente din personlige API-nøkkel under **Dashboard → API keys** (<https://tech-ai.tech/dashboard/api-keys>).

### 1. OpenAI-kompatibelt API (`/v1/chat/completions`)
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

- **Modelliste:** `GET https://tech-ai.tech/v1/models`
- **VS Code-oppsett:** Se guiden på <https://tech-ai.tech/docs/vscode> for å bruke Tech AI Monkey direkte i VS Code som en Custom Endpoint.

### 2. Direkte Sesjons-API (`/eve/v1/session`)

```bash
# Start en sesjon
curl -X POST https://tech-ai.tech/eve/v1/session \
  -H "Authorization: Bearer tai_DIN_API_NOKKEL" \
  -H "Content-Type: application/json" \
  -d '{"message": "Hei fra serveren min!"}'
```

---

## 📞 Support & Kontakt

- **E-post:** support@tech-ai.tech
- **Nettside:** <https://tech-ai.tech>
- **WhatsApp:** <https://wa.me/4748904267>
- **GitHub:** <https://github.com/Salazar-Rivero-Smart-Things/tech-ai-monkey>
