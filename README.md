# Tech AI monkey

> **Live:** <https://tech-ai.tech> · **v2.1 (tech-ai.tech monkey v2.1 / 100 % lokal Ollama-motor)**  
> © Salazar Rivero Smart Things (org. 933 853 195, Norge)

**Tech AI monkey v2.1** er en 100 % selvstendig, selvlærende, kryssplattform AI-agent (macOS, Linux og Windows) som kjører på egen lokal **Ollama**-motor med kontinuerlig API-nøkkelrotasjon, web-dashboard, terminal-CLI, PHP/HTML-kodebygger og OpenAI/Ollama-kompatibelt API.

---

## Installere repoet på egen maskin

Dette er hele veien fra tom maskin til <https://tech-ai.tech> svarer. Har du en
ferdig Ubuntu-server kan du hoppe rett til [punkt 2](#2-ollama-og-den-lokale-modellen).
Full gjennomgang av OS, ZFS, brannmur og backup: [docs/ubuntu-server-oppsett.md](./docs/ubuntu-server-oppsett.md).

### 1. Krav

| Du trenger | Merk |
|---|---|
| Linux x86-64 med `/dev/kvm` | Microsandbox (sandkassen agenten kjører kode i) krever KVM. Sjekk med `ls -l /dev/kvm`. |
| **Node 24** + npm | `nvm use` i repoet følger [.nvmrc](./.nvmrc). Node 24 er minimum – ikke 20/22. |
| git | |
| **Ollama** | Motoren som kjører modellen lokalt. Port `11434`. |
| PostgreSQL | Database for web-appen (`deploy/setup-db.sh` lager rolle, database og tabeller). |
| `ffmpeg` | Videoanalyse (agenten henter stillbilder fra videoer). |
| `systemd` | Tjenestene `myai-agent`, `myai-web`, `myai-healthcheck.timer`. |
| `cloudflared` | Bare hvis du vil publisere på internett (punkt 7). |

```bash
git clone https://github.com/Salazar-Rivero-Smart-Things/tech-ai-monkey.git
cd tech-ai-monkey
nvm use          # Node 24
```

### 2. Ollama og den lokale modellen

```bash
# Installer Ollama (Linux, én linje – lager også ollama.service)
curl -fsSL https://ollama.com/install.sh | sh

# Har du snap-utgaven? Da ligger binæren i /snap/bin/ollama.
# Agenten og tjenestefilen finner den selv; ellers sett OLLAMA_BIN i .env.

# Bygg modellen repoet bruker (navnet må være tech-ai-monkey)
cd /sti/til/tech-ai-monkey
ollama create tech-ai-monkey -f Modelfile.tech-ai-monkey

# Kontroller at motoren svarer og at modellen finnes
curl -s http://127.0.0.1:11434/api/tags
```

`ollama create` henter grunnmodellen `llama3.2:3b` (~2 GB) første gang.

Uten Ollama på plass bygger agenten fortsatt, men den kan ikke svare i chatten;
supervisor-tjenesten i agenten vil logge `ollama utilgjengelig` hvert minutt.

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
| `.env` | `OLLAMA_MODEL` / `OLLAMA_BASE_URL` | `tech-ai-monkey` / `http://127.0.0.1:11434/v1` (standard) |
| `web/.env.local` | `AUTH_SECRET`, `SECRET_KEK` | `openssl rand -base64 32` (hver sin) |
| `web/.env.local` | `AGENT_API_KEY_SECRET` | **nøyaktig samme** som i `.env` |
| `web/.env.local` | `EVE_AGENT_URL` | `http://127.0.0.1:2000` |
| `web/.env.local` | `NEXT_PUBLIC_APP_URL` / `AUTH_URL` | `https://tech-ai.tech` |
| `web/.env.local` | `DATABASE_URL` | skrives automatisk av punkt 4 |

### 4. Database

```bash
bash deploy/setup-db.sh
```

Scriptet oppretter Postgres-rollen og databasen, skriver `DATABASE_URL` i
`web/.env.local` og kjører `drizzle-kit push`. **Må kjøres før web-appen bygges** —
`next build` leser `DATABASE_URL` fra `web/.env.local` og stopper ellers med
`DATABASE_URL is not set`.

### 5. Bygg begge appene

```bash
# Agenten (rot) – må bygges først
npm install
npm run build          # bygger .output/ og patcher eve (postbuild)

# Web-appen
cd web
npm install
npm run build          # lager web/.next/BUILD_ID
cd ..
```

### 6. Installer tjenestene

```bash
bash deploy/install-services.sh --dry-run   # se hva som skrives, uten å endre noe
sudo bash deploy/install-services.sh        # skriver /etc/systemd/system/*.service
```

Scriptet fyller inn riktig bruker, repo-sti og Node-sti, aktiverer
`myai-agent` (port **2000**), `myai-web` (port **3100**) og
`myai-healthcheck.timer`, og peker Cloudflare-tunnelen mot port 3100 hvis den
finnes. Det nekter å kjøre hvis `.output/server/index.mjs` eller
`web/.next/BUILD_ID` mangler – altså må punkt 5 være ferdig.

### 7. Cloudflare Tunnel (offentlig HTTPS)

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

Sjekk hva tunnelen faktisk har fått av regler:

```bash
journalctl -u cloudflared --since "-10min" | grep -i "ingress\|config"
# «No ingress rules were defined … will return 503» = ingen vertsnavn i dashbordet
```

### Rekkefølge ved oppstart og restart

Start alltid i denne rekkefølgen — hver tjeneste er avhengig av den forrige:

```bash
sudo systemctl start ollama            # 1. modellmotoren, port 11434
sudo systemctl start postgresql        # 2. databasen, port 5432
sudo systemctl enable --now myai-agent # 3. agenten, port 2000
sudo systemctl enable --now myai-web   # 4. nettsiden, port 3100
sudo systemctl enable --now cloudflared# 5. tunnelen, tech-ai.tech -> 3100
```

| Rekkefølge | Tjeneste | Hvorfor |
|---|---|---|
| 1 | `ollama` | Agenten kaller `http://127.0.0.1:11434` på hvert modelsvar. Uten den svarer chatten aldri. |
| 2 | `postgresql` | Web-appen leser brukere, nøkler og kvoter fra databasen ved første request. |
| 3 | `myai-agent` | Web-appen proxyer `/v1/*` og `/eve/*` til `127.0.0.1:2000`. `myai-web.service` har `After=myai-agent.service`. |
| 4 | `myai-web` | Må svare på port 3100 før tunnelen har noe å sende trafikk til. |
| 5 | `cloudflared` | Sender `tech-ai.tech` → `127.0.0.1:3100`. Rekkefølgen mot 3/4 er ikke kritisk, men uten 3 og 4 får du 502 fra Cloudflare. |

> **Kort svar:** agenten og web-appen **før** tunnelen. Tunnelen er bare
> inngangsdøren til port 3100 – er ikke web-appen oppe, viser den 502 Bad Gateway.

Sjekk at alt lever:

```bash
curl -s -o /dev/null -w 'agent  %{http_code}\n' http://127.0.0.1:2000/
curl -s -o /dev/null -w 'web    %{http_code}\n' http://127.0.0.1:3100/download
curl -s -o /dev/null -w 'offent %{http_code}\n' https://tech-ai.tech/
journalctl -u myai-agent -f     # agentens logg
journalctl -u myai-web -f       # web-appens logg
journalctl -u cloudflared -f    # tunnelens logg
```

Vedlikehold og feilsøking: [docs/ubuntu-server-oppsett.md](./docs/ubuntu-server-oppsett.md#16-feilsøking).

> **Portene 2000 og 3100 er ikke åpne utover maskinen.** `npm run start` binder
> både agenten (`eve start --host 127.0.0.1`) og web-appen
> (`next start -H 127.0.0.1`) til loopback, så de er utilgjengelige fra
> nettverket uansett hva brannmuren skulle tillate. All trafikk går gjennom
> Cloudflare-tunnelen. Trenger du å se dem fra en annen maskin:
>
> ```bash
> ssh -L 3100:127.0.0.1:3100 bruker@server   # så: http://localhost:3100
> ```

### Oppdatere en eksisterende installasjon

```bash
git pull
npm install && npm run build
cd web && npm install && npm run build && cd ..
sudo systemctl restart myai-agent myai-web
```

Avhengighetene holdes oppdatert av Dependabot ([.github/dependabot.yml](./.github/dependabot.yml)),
og CI ([.github/workflows/security.yml](./.github/workflows/security.yml)) kjører
`npm audit --omit=dev --audit-level=high` på både rot og `web`. Vil du sjekke selv:

```bash
npm audit --omit=dev
cd web && npm audit --omit=dev
```

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

### 3. Lokal Ollama-motor (`tech-ai-monkey` v2.1) & kontinuerlig nøkkelrotasjon

**Tech AI monkey v2.1** kjører 100 % selvstendig på egen lokal **Ollama**-motor uten eksterne OpenAI/DeepSeek-avhengigheter:

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

