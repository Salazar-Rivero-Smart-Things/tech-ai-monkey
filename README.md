# Tech AI monkey

> **Live:** <https://tech-ai.tech> · **v2.1 (`tech-ai.tech monkey v2.1` — 100 % lokal AI-motor via `llama.cpp` / `llama-server`)**  
> © Salazar Rivero Smart Things (org. 933 853 195, Norge)

**Tech AI monkey v2.1** er en 100 % selvstendig, selvlærende, kryssplattform AI-agent (Windows, macOS og Linux/Ubuntu) som kjører på egen lokal GPU-akselerert **llama.cpp (`llama-server`)**-motor uten eksterne skylleverandører eller bakdører, med web-dashboard, terminal-CLI (`.dmg`, `.deb`, `.exe`), PHP/HTML-kodebygger og OpenAI-kompatibelt API.

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

## Kjøre på Windows (hovedmiljø med GPU)

På Windows startes og stoppes hele miljøet i riktig rekkefølge med ett klikk eller fra terminalen:

```bat
:: Starter:
::   1. PostgreSQL          (port 5432)
::   2. llama-server (GPU)  (port 8080, http://127.0.0.1:8080/v1)
::   3. AI Agent            (port 2000, http://127.0.0.1:2000)
::   4. Web App / Dashboard (port 3100, http://127.0.0.1:3100)
start-tech-ai-monkey.bat

:: Stopper Web App (3100), AI Agent (2000) og llama-server (8080):
stop-tech-ai-monkey.bat
```

Du kan også starte kun modellserveren separat med:

```bat
scripts\start-llama-server.bat
```

---

## Installere og kjøre på Linux / Ubuntu-server

Dette er hele veien fra tom maskin til <https://tech-ai.tech> svarer. Full gjennomgang av OS, ZFS, brannmur og backup: [docs/ubuntu-server-oppsett.md](./docs/ubuntu-server-oppsett.md).

### 1. Krav

| Du trenger | Merk |
|---|---|
| Linux x86-64 (eller Windows med GPU) | Agenten har innebygd lokal sandkasse og supervisor (`agent/lib/supervisor.ts`). |
| **Node 24** + npm | `nvm use` i repoet følger [.nvmrc](./.nvmrc). Node 24 er minimum – ikke 20/22. |
| git | |
| **llama-server (`llama.cpp`)** | Motoren som kjører GGUF-modellen lokalt på **port `8080`** (`http://127.0.0.1:8080/v1`). |
| PostgreSQL | Database på **port `5432`** (`deploy/setup-db.sh` lager rolle, database og tabeller). |
| `ffmpeg` | Videoanalyse (agenten henter stillbilder fra videoer). |
| `systemd` (på Linux) | Tjenestene `myai-agent` (port `2000`), `myai-web` (port `3100`), `myai-healthcheck.timer`. |
| `cloudflared` | Publiserer port `3100` til <https://tech-ai.tech> (punkt 7). |

```bash
git clone https://github.com/Salazar-Rivero-Smart-Things/tech-ai-monkey.git
cd tech-ai-monkey
nvm use          # Node 24
```

### 2. Lokal AI-motor (`llama-server` på port 8080)

Agenten (`agent/agent.ts`) kobler seg til `LOCAL_AI_BASE_URL` (standard `http://127.0.0.1:8080/v1`):

```bash
# Start llama-server med en GGUF-modell på port 8080:
llama-server -m models/qwen2.5-coder-7b-instruct-q4_k_m.gguf \
  --port 8080 --host 127.0.0.1 -ngl 99 -c 8192

# Kontroller at motoren svarer på port 8080:
curl -s http://127.0.0.1:8080/health
```

*(Bruker du en annen lokal OpenAI-kompatibel server eller port, sett `LOCAL_AI_BASE_URL` og `LOCAL_AI_MODEL` i `.env`.)*

### 3. Hemmeligheter

```bash
cp .env.example .env
cp web/.env.example web/.env.local
chmod 600 .env web/.env.local
```

| Fil | Variabel | Verdi |
|---|---|---|
| `.env` | `AGENT_API_KEY_SECRET` | `openssl rand -hex 32` |
| `.env` | `EVE_PUBLIC_URL` | `http://127.0.0.1:2000` |
| `.env` | `LOCAL_AI_BASE_URL` / `LOCAL_AI_MODEL` | `http://127.0.0.1:8080/v1` / `default` (standard) |
| `web/.env.local` | `AUTH_SECRET`, `SECRET_KEK` | `openssl rand -base64 32` (hver sin) |
| `web/.env.local` | `AGENT_API_KEY_SECRET` | **nøyaktig samme** som i `.env` |
| `web/.env.local` | `EVE_AGENT_URL` | `http://127.0.0.1:2000` |
| `web/.env.local` | `NEXT_PUBLIC_APP_URL` / `AUTH_URL` | `https://tech-ai.tech` (eller `http://localhost:3100` lokalt) |
| `web/.env.local` | `DATABASE_URL` | `postgresql://...@127.0.0.1:5432/tech_ai_monkey` (skrives av punkt 4) |

### 4. Database (port 5432)

```bash
bash deploy/setup-db.sh
```

Scriptet oppretter Postgres-rollen og databasen på port `5432`, skriver `DATABASE_URL` i
`web/.env.local` og kjører `drizzle-kit push`. **Må kjøres før web-appen bygges** —
`next build` leser `DATABASE_URL` fra `web/.env.local` og stopper ellers med
`DATABASE_URL is not set`.

### 5. Bygg begge appene

```bash
# Agenten (rot, port 2000) – må bygges først
npm install
npm run build          # bygger .output/ og patcher eve (postbuild)

# Web-appen (web/, port 3100)
cd web
npm install
npm run build          # lager web/.next/BUILD_ID
cd ..
```

### 6. Installer tjenestene (Linux systemd)

```bash
bash deploy/install-services.sh --dry-run   # se hva som skrives, uten å endre noe
sudo bash deploy/install-services.sh        # skriver /etc/systemd/system/*.service
```

Scriptet fyller inn riktig bruker, repo-sti og Node-sti, aktiverer
`myai-agent` (port **2000**), `myai-web` (port **3100**) og
`myai-healthcheck.timer`, og peker Cloudflare-tunnelen mot port **3100** hvis den
finnes. Det nekter å kjøre hvis `.output/server/index.mjs` eller
`web/.next/BUILD_ID` mangler – altså må punkt 5 være ferdig.

### 7. Cloudflare Tunnel (offentlig HTTPS → port 3100)

```bash
curl -L -o /tmp/cloudflared.deb \
  https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i /tmp/cloudflared.deb

cloudflared tunnel login        # velg sonen tech-ai.tech i nettleseren
bash deploy/setup-cloudflare-tunnel.sh
```

Scriptet oppretter/gjenbruker tunnelen, setter DNS for `tech-ai.tech` og
`www.tech-ai.tech`, installerer `cloudflared.service`, og **slår av Caddy** (den
trengs ikke når tunnelen tar HTTPS). Ingen porter må åpnes i ruteren.

#### Har du allerede en tunnel fra Cloudflare-dashbordet?

Da kjører `cloudflared` med en token-fil (`/etc/cloudflared/token`), og
**inngangsreglene ligger i dashbordet — ikke i en lokal `config.yml`**. En slik
tunnel svarer `503` på alt og gir feilkode **1033** i nettleseren helt til du
legger inn vertsnavnet:

1. <https://one.dash.cloudflare.com> → **Networks → Tunnels**
2. Velg tunnelen med status **HEALTHY** (det er den som kjører på maskinen)
3. **Public Hostname → Add a public hostname**
   - Subdomain: *(tom)* · Domain: `tech-ai.tech` · Type: `HTTP` · URL: `localhost:3100`
   - Gjenta med Subdomain `www`
4. Vent noen sekunder og test: `curl -sI https://tech-ai.tech | head -1`

### Rekkefølge ved oppstart og restart

Start alltid i denne rekkefølgen — hver tjeneste er avhengig av den forrige:

| Rekkefølge | Tjeneste | Port | Hvorfor |
|---|---|---|---|
| 1 | `postgresql` | `5432` | Web-appen leser brukere, nøkler og kvoter fra databasen ved første request. |
| 2 | `llama-server` | `8080` | Agenten kaller `http://127.0.0.1:8080/v1` på hvert modelsvar. |
| 3 | `myai-agent` (`npm run start`) | `2000` | Web-appen proxyer `/v1/*` og `/eve/*` til `127.0.0.1:2000`. |
| 4 | `myai-web` (`cd web && npm run start`) | `3100` | Må svare på port `3100` før tunnelen har noe å sende trafikk til. |
| 5 | `cloudflared` | HTTPS → `3100` | Sender `tech-ai.tech` → `127.0.0.1:3100`. Uten 3 og 4 får du 502 fra Cloudflare. |

Sjekk at alt lever:

```bash
curl -s -o /dev/null -w 'llama  %{http_code}\n' http://127.0.0.1:8080/health
curl -s -o /dev/null -w 'agent  %{http_code}\n' http://127.0.0.1:2000/
curl -s -o /dev/null -w 'web    %{http_code}\n' http://127.0.0.1:3100/download
curl -s -o /dev/null -w 'offent %{http_code}\n' https://tech-ai.tech/
```

> **Portene 8080, 2000 og 3100 er ikke åpne utover maskinen.** `npm run start` binder
> både agenten (`eve start --host 127.0.0.1 --port 2000`) og web-appen
> (`next start -H 127.0.0.1 -p 3100`) til loopback, så de er utilgjengelige fra
> nettverket uansett hva brannmuren skulle tillate. All trafikk går gjennom
> Cloudflare-tunnelen.

---

## Bygge nedlastingsfilene (`.dmg` for macOS og `.deb` for Linux/Ubuntu) til `tech-ai.tech/download`

Nedlastingssiden (<https://tech-ai.tech/download>) viser automatisk pakkene som ligger i `web/public/downloads/` sammen med SHA-256-sjekksummene fra `web/public/downloads/checksums.txt`.

```bash
# 1. Bygg macOS universal DMG (Apple Silicon arm64 + Intel x86_64):
bash scripts/build-dmg.sh
# -> web/public/downloads/tech-ai_2.1.0_macos_universal.dmg

# 2. Bygg Linux / Ubuntu / Debian (.deb):
bash scripts/build-cli.sh --linux-only
# -> web/public/downloads/tech-ai_2.1.0_amd64.deb

# (Eller bygg både Linux .deb og Windows .exe samtidig:)
bash scripts/build-cli.sh
```

Når filene i `web/public/downloads/` oppdateres på maskinen som kjører web-appen (port `3100`), restartes web-appen for at Next.js skal servere de nye filene.

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
- **Rimelig betaling:** Når du trenger mer enn gratiskvoten, må du betale for ekstra bruk eller abonnement — prisene er svært lave og rimelige (støtter kort/Stripe, PayPal, Vipps (nr: **139973**) og krypto under **Dashboard → Subscription** på <https://tech-ai.tech/pricing>).

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

- **Modeller:** `GET https://tech-ai.tech/v1/models` (`tech-ai-monkey` – v2.1)
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

### 3. Lokal `llama.cpp`-motor (`tech-ai-monkey` v2.1) & innebygd supervisor

**Tech AI monkey v2.1** kjører 100 % selvstendig på egen lokal **llama.cpp (`llama-server`)**-motor på port `8080` uten eksterne OpenAI/DeepSeek-avhengigheter:

```bash
# På Windows (GPU-akselerert med RTX):
scripts\start-llama-server.bat

# På Linux / macOS:
llama-server -m models/qwen2.5-coder-7b-instruct-q4_k_m.gguf --port 8080 --host 127.0.0.1 -ngl 99 -c 8192
```

- **Innebygd selvhelbredelse (`agent/lib/supervisor.ts`):** Overvåker sandkasser og kjøringer automatisk hvert minutt i prosessen (port `2000`), rydder opp fastlåste turer og holder ressursbruken lav uten eksterne cron-jobber.
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

