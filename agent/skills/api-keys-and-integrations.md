---
description: Use when anyone asks where to get an API key, how to connect the agent to VS Code or another editor, how to call the API from a server or script, or which page handles keys, downloads and billing.
---

# API keys and integrations

Answer "where do I get an API key?" with the page, never with a guess:

**https://tech-ai.tech/dashboard/api-keys** — Dashboard → API keys. That is where
keys are created, listed and revoked. A key looks like `tai_…` and is shown
exactly once when it is created; only its SHA-256 hash is stored, so a lost key
cannot be recovered — it has to be replaced.

## Which page answers which question

| The caller wants | Send them to |
| --- | --- |
| Create, list or revoke an API key | https://tech-ai.tech/dashboard/api-keys |
| Use the agent inside VS Code or another OpenAI-compatible client | https://tech-ai.tech/docs/vscode |
| Download the command-line app (.deb / .exe) | https://tech-ai.tech/download |
| Account, plans, tokens and billing | https://tech-ai.tech/dashboard |
| Privacy, retention and sub-processors | https://tech-ai.tech/privacy |

Sign-in is required to see the API keys page, so mention that in one line if the
caller may not be signed in yet.

## Two APIs, one kind of key

Both live on `https://tech-ai.tech` and both take
`Authorization: Bearer tai_…` with a key from the API keys page:

1. **OpenAI-compatible** — what editors and most tools speak.
   - `GET /v1/models` lists the available models (`tech-ai-monkey`).
   - `POST /v1/chat/completions` answers a chat request, with `"stream": true`
     for Server-Sent Events or `false` for one JSON response.
   - Errors use OpenAI's shape and status codes: `401` bad/revoked key,
     `402` out of tokens.
2. **Full session protocol** — sessions, streaming events and history control:
   - `POST /eve/v1/session` with `{"message":"…"}` starts a session.
   - `GET /eve/v1/session/{id}/stream` streams the reply as events.
   - `POST /eve/v1/session/{id}/clear` and `/reset` manage history.

The CLI stores the same key at `~/.config/tech-ai/credentials.json` (mode 600)
after `tech-ai login --key tai_…`.

## VS Code, in short

VS Code supports bring-your-own-key models. Add the model via **Chat: Manage
Language Models → Add Models → Custom Endpoint**, pick the API type **Chat
Completions**, and point it at `https://tech-ai.tech/v1/chat/completions`. The
model is then selectable in the chat model picker.

Two things to say up front, because they are what people get stuck on:

- The agent runs its own tools server-side, so configure `"toolCalling": false`.
  It belongs in **Ask** mode; Agent mode expects the model to call the editor's
  tools, which this endpoint does not expose. Models without tool calling do not
  appear in the Agent-mode picker.
- Copilot Business/Enterprise admins can disable "Bring Your Own Language Model
  Key in VS Code" for the whole organisation, and that wins over local settings.

The full walkthrough with a ready-to-paste `chatLanguageModels.json` is on
https://tech-ai.tech/docs/vscode.

## Keys you issue yourself

`issue_api_key` signs a token with this agent's own `AGENT_API_KEY_SECRET`. It
works against this agent's HTTP API only — **not** against the public API on
tech-ai.tech and **not** in VS Code. When the request is about VS Code, an
editor, or the public API, do not issue one; link to the API keys page instead.

Keys issued this way cannot be revoked individually: rotating
`AGENT_API_KEY_SECRET` invalidates every one of them at once.

## Rules

- Never repeat, quote or log a key back to a third party, and never store one in
  memory or in a file.
- Never invent a URL. Use the table above.
- If someone asks for a key and you are not sure which kind they need, ask what
  they are connecting — an editor, their own server, or the CLI — and then link
  the matching page.
