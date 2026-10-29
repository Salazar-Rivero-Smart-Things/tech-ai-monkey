import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { defineAgent } from "eve";

import {
  createSelfHealingModelFetch,
  getActiveOllamaApiKey,
  getOllamaBaseUrl,
  getOllamaContextTokens,
  getOllamaModelId,
} from "./lib/ollama-auth";
import { startSupervisor } from "./lib/supervisor";

// ---------------------------------------------------------------------------
// Tech AI Monkey – tech-ai.tech monkey v2.0 (Selvstendig lokal Ollama-motor)
//
// Kjører 100 % uavhengig på egen server via lokal Ollama (http://127.0.0.1:11434/v1)
// med kontinuerlig automatisk rotasjon av API-nøkkel og selvhelbredelse, slik
// at agenten aldri stopper opp på grunn av utløpte eksterne nøkler.
// ---------------------------------------------------------------------------

export const AGENT_VERSION = "v2.0.1";
export const AGENT_CORE_CODENAME = "tech-ai.tech monkey v2.0.1";

const MODEL_ID = getOllamaModelId();
const BASE_URL = getOllamaBaseUrl();
const contextTokens = getOllamaContextTokens();

// Tidsgrense for hele modelsvaret inkludert streaming (standard 300 s for lokal inferens).
const MODEL_TIMEOUT_MS = Number(process.env.AGENT_MODEL_TIMEOUT_MS ?? 300_000) || 300_000;

const fetchWithTimeout = createSelfHealingModelFetch(MODEL_TIMEOUT_MS);

const model = createOpenAICompatible({
  name: "tech-ai-monkey",
  baseURL: BASE_URL,
  apiKey: getActiveOllamaApiKey(),
  fetch: fetchWithTimeout,
}).chatModel(MODEL_ID);

console.log(`[agent] ${AGENT_CORE_CODENAME} -> lokal motor: ${MODEL_ID} (${BASE_URL}, kontinuerlig nøkkelrotasjon aktiv)`);

// Selvhelbredelse og nøkkelrotasjon ligger i selve agenten: ingen cron-jobb
// eller ekstern leverandør den er avhengig av. Se agent/lib/supervisor.ts.
startSupervisor();

export default defineAgent({
  model,
  modelContextWindowTokens: contextTokens,
});
