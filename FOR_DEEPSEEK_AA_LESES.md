# FOR DEEPSEEK Å LESES — Tech AI Monkey v2.1 (Les alltid først!)

- **Prosjekt:** Tech AI Monkey v2.1 (`https://tech-ai.tech` / `https://www.tech-ai.tech`)
- **Eier:** Salazar Rivero Smart Things (ENK, org.nr 933 853 195) — Hollman Enrique Salazar Rivero
- **GitHub-repo (OFFENTLIG / PUBLIC!):** `https://github.com/Salazar-Rivero-Smart-Things/tech-ai-monkey`
  - **VIKTIG SIKKERHETSREGEL:** Repoet er **PUBLIC** — **ALDRI** commit `.env`, `web/.env.local`, passord, Stripe/PayPal/Auth-nøkler, Cloudflare-tokens eller `MCP_API_KEY`! Alle hemmeligheter skal **KUN** ligge i lokal `.env` (blokkert i `.gitignore`) eller som **Railway Environment Variables**.
- **Lokal sti (Windows):** `C:\Users\Pepito Liindo\Documents\MyGits\Tech-AI-Monkey\tech-ai-monkey`
- **Produksjon på Railway (24/7 i skyen, region `europe-west4`):**
  - **Railway Prosjekt:** `Tech-AI-Monkey` (`70f191b0-9b7d-4655-92d3-3e6bd53e5747`), miljø `production`
  - **4 kjørende tjenester:**
    1. **`Postgres`** — Managed Railway PostgreSQL (tabeller opprettes automatisk av `web` via `npx drizzle-kit push --force` + `scripts/seed-admin.mjs`).
    2. **`qwen-mcp-server`** (`deploy/Dockerfile.llama` + 5 GB Volume `/models`) — Kjører **`Qwen2.5-Coder-7B-Instruct-Q4_K_M.gguf`** lokalt på Railway CPU (`llama-server` med `q8_0` KV-cache) + `deploy/qwen-mcp-gateway.mjs`:
       - Internt OpenAI-API til agenten: `http://qwen-mcp-server.railway.internal:8080/v1`
       - Offentlig **MCP Server (Streamable HTTP JSON-RPC 2.0)**: `https://qwen-mcp-server-production.up.railway.app/mcp` (beskyttet med `MCP_API_KEY` i Railway Variables; verktøy: `qwen_ask`, `qwen_review_code`, `qwen_generate_code`).
    3. **`agent`** (`deploy/Dockerfile.agent`) — Tech AI Monkey Eve AI-agent (`npx eve start --host :: --port 2000`), koblet internt mot `qwen-mcp-server`.
    4. **`web`** (`deploy/Dockerfile.web` + `deploy/start-web-railway.sh`) — Next.js 16 dashboard, innlogging, CLI-API og Stripe/PayPal/Vipps (`#139973`) abonnementer, eksponert på `https://tech-ai.tech` og `https://www.tech-ai.tech`.
- **Lokal Windows-drift (valgfritt, når du vil teste lokalt med RTX 2070 GPU):**
  - Bygg i PowerShell: `npm.cmd install && npm.cmd run build` (rot) + `cd web && npm.cmd install && npm.cmd run build`
  - Start alt lokalt: `.\start-tech-ai-monkey.bat` (inkl. steg `[5/5] Cloudflare Tunnel`)
  - Stopp alt lokalt: `.\stop-tech-ai-monkey.bat`
- **Samarbeidsprotokoll (Gemini <-> DeepSeek):**
  1. Les alltid `FOR_DEEPSEEK_AA_LESES.md`, `Gemini_Supervisor.log` og `Deepseek_Supervisor.log` før endringer.
  2. Verifiser alltid `git diff --cached --name-only` før commit så ingen `.env` eller hemmelige nøkler noen gang pushes til dette offentlige repoet.
  3. Logg alltid nye endringer øverst i `[ENDRINGSLOGG]` i både `Deepseek_Supervisor.log` og `Gemini_Supervisor.log`.
