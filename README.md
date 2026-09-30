# My AI Agent

A durable, self-improving AI agent built on [eve](https://eve.dev) that:

- **Searches the whole web** until it finds the issue or fix (`web_search` +
  `web_fetch`, guided by the `deep-web-research` skill).
- **Keeps learning** between conversations via cross-session memory.
- **Has a library** of reusable skills under `agent/skills/`.
- **Deletes chat history** on request (Clear / Reset).
- **Issues API keys** so your server can talk to it over HTTP.
- **Can be asked** in the terminal UI or the built-in web chat.

## Requirements

- Node.js **24 or newer**
- A model credential (connect a Vercel account / AI Gateway / OpenAI / Anthropic
  in the terminal UI on first run)

## Setup

```bash
npm install

# Create the API-key secret used to mint/verify keys
cp .env.example .env
# edit .env and set AGENT_API_KEY_SECRET to a long random string,
# e.g. $(openssl rand -hex 32)

npm run dev
```

On first run the terminal UI opens `/login` to connect a model. After that you
can chat with the agent.

## Ask the agent

- Terminal UI: type in the `npm run dev` session.
- Web chat: open <http://127.0.0.1:2000/> (no key needed in local dev).

Ask it things like:

- "Find out why my Next.js build fails with error X and give me the fix."
- "Give me an API key for my Node server."
- "Delete this chat history."

## Hook up your server (HTTP API)

The agent exposes the eve HTTP API. In production every route requires
`Authorization: Bearer <apiKey>`.

```bash
# 1) Get a key from the agent ("give me an API key"), then:

# Create a session and send the first message
curl -X POST http://127.0.0.1:2000/eve/v1/session \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"message":"Hello"}'

# Continue the session
curl -X POST http://127.0.0.1:2000/eve/v1/session/<sessionId> \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"message":"Follow up"}'

# Stream the reply (NDJSON)
curl http://127.0.0.1:2000/eve/v1/session/<sessionId>/stream \
  -H "Authorization: Bearer $API_KEY"
```

### Session control (delete history)

| Action        | Endpoint                                       |
| ------------- | ---------------------------------------------- |
| Clear history | `POST /eve/v1/session/:sessionId/clear`        |
| Delete/reset  | `POST /eve/v1/session/:sessionId/reset`        |
| Cancel turn   | `POST /eve/v1/session/:sessionId/cancel`       |

## Project layout

```
agent/
  agent.ts                    # model config
  instructions.md             # system prompt / operating rules
  channels/eve.ts             # HTTP API auth (API keys)
  channels/web.ts             # serves the web chat UI at /
  tools/issue_api_key.ts      # "give me an API key"
  tools/delete_chat_history.ts# "delete my history"
  memory/knowledge.ts         # cross-session learning
  skills/                     # the reusable skills library
  lib/jwt.ts                  # API-key minting helper
public/index.html             # web chat UI
```

## Deploying

On Vercel:

```bash
npx vercel link
npx vercel env add AGENT_API_KEY_SECRET   # and EVE_PUBLIC_URL = your deployment URL
npx vercel deploy --prod
```

`AGENT_API_KEY_SECRET` must be set in the production environment or the API-key
auth falls back to fail-closed (no external access). Keep it secret.
