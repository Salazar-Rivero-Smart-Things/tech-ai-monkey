import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { defineAgent } from "eve";

import { startSupervisor } from "./lib/supervisor";

// ---------------------------------------------------------------------------
// Tech AI Monkey – tech-ai.tech monkey v2.0 (DeepSeek Flash Vision)
//
// Modellen er hardkodet med vilje: én leverandør, ett modellnavn, ingen
// ruting eller fallback. Det gjør oppførselen forutsigbar.
//
//   Modell:  deepseek-v4-flash-vision-exp
//            (DeepSeek-V4.1-Flash; teksten «deepseek-flash» er det serveren
//             rapporterer tilbake. Tar både tekst og bilder, 1M kontekst.)
//   Nøkkel:  DEEPSEEK_API_KEY i .env – aldri i koden.
// ---------------------------------------------------------------------------

export const AGENT_VERSION = "v2.0.0";
export const AGENT_CORE_CODENAME = "tech-ai.tech monkey v2.0";

/** Modellen hele agenten bruker. */
const MODEL_ID = "deepseek-v4-flash-vision-exp";
const BASE_URL = "https://api.deepseek.com/v1";

const contextTokens = (() => {
  const n = Number(process.env.OPENAI_COMPAT_CONTEXT_TOKENS);
  return Number.isFinite(n) && n > 0 ? n : 1_048_576;
})();

// Et modelsvar som aldri kommer tilbake skal feile, ikke henge chatten.
// Uten dette ble en tur stående i «running» i det uendelige.
const MODEL_TIMEOUT_MS = Number(process.env.AGENT_MODEL_TIMEOUT_MS ?? 120_000) || 120_000;

const fetchWithTimeout: typeof fetch = async (input, init) => {
  const timeout = AbortSignal.timeout(MODEL_TIMEOUT_MS);
  const signal = init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
  try {
    return await fetch(input, { ...init, signal });
  } catch (error) {
    if (timeout.aborted) {
      throw new Error(`modellen svarte ikke innen ${Math.round(MODEL_TIMEOUT_MS / 1000)} s`);
    }
    throw error;
  }
};

const model = createOpenAICompatible({
  name: "tech-ai-monkey",
  baseURL: BASE_URL,
  apiKey: process.env.DEEPSEEK_API_KEY ?? "",
  fetch: fetchWithTimeout,
}).chatModel(MODEL_ID);

console.log(`[agent] ${AGENT_CORE_CODENAME} -> modell: ${MODEL_ID} (${BASE_URL})`);

// Selvhelbredelse ligger i selve agenten: ingen cron-jobb eller skript kunden
// må huske å kjøre. Se agent/lib/supervisor.ts.
startSupervisor();

export default defineAgent({
  model,
  modelContextWindowTokens: contextTokens,
});
