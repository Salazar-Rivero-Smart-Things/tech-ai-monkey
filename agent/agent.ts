import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { defineAgent } from "eve";

// ---------------------------------------------------------------------------
// Tech AI Monkey – tech-ai.tech monkey v2.0 (Qwen 3.8)
//
// Modellen er hardkodet med vilje: én leverandør, ett modellnavn, ingen
// automatisk ruting eller failover. Det gjør oppførselen forutsigbar.
//
// Endepunkt og nøkkel kommer fra .env (nøkler skal aldri ligge i koden):
//
//   OPENAI_COMPAT_BASE_URL=https://api.groq.com/openai/v1
//   OPENAI_COMPAT_API_KEY=gsk_...
//   OPENAI_COMPAT_CONTEXT_TOKENS=131072   (valgfritt)
//
// Vil du bytte leverandør senere, er det bare baseURL i .env.
// ---------------------------------------------------------------------------

export const AGENT_VERSION = "v2.0.0";
export const AGENT_CORE_CODENAME = "tech-ai.tech monkey v2.0";

/** Qwen 3.8 – modellen hele agenten bruker. */
const MODEL_ID = "qwen/qwen3.8-27b";

const BASE_URL = (process.env.OPENAI_COMPAT_BASE_URL ?? "https://api.groq.com/openai/v1").replace(
  /\/+$/,
  "",
);

const contextTokens = (() => {
  const n = Number(process.env.OPENAI_COMPAT_CONTEXT_TOKENS);
  return Number.isFinite(n) && n > 0 ? n : 131_072;
})();

// Groq sin on-demand-kvote for qwen3.8-27b er 7000 input-tokens per minutt.
// Agentens instruksjoner + verktøy er større enn det, så en samtale ville
// alltid bli avvist. Derfor: Qwen er modellen, men hvis leverandøren avviser
// kallet på grunn av kvoten, sendes akkurat det kallet videre til DeepSeek.
const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY?.trim() || "";
const DEEPSEEK_URL = "https://api.deepseek.com/v1/chat/completions";

const fetchWithQuotaFallback: typeof fetch = async (input, init) => {
  const res = await fetch(input, init);
  if (res.ok || !DEEPSEEK_KEY) return res;

  const detail = await res.clone().text().catch(() => "");
  if (!/Request too large|ITPM|OTPM|rate limit|tokens per minute/i.test(`${res.status} ${detail}`)) {
    return res;
  }

  let body = typeof init?.body === "string" ? init.body : "";
  if (!body) return res;
  try {
    const parsed = JSON.parse(body) as Record<string, unknown>;
    parsed.model = "deepseek-chat";
    if (typeof parsed.max_tokens === "number" && parsed.max_tokens > 8192) {
      parsed.max_tokens = 8192;
    }
    body = JSON.stringify(parsed);
  } catch {
    return res;
  }

  console.warn(`[agent] qwen-kvoten er brukt opp (${res.status}); bruker deepseek-chat for dette kallet`);
  return fetch(DEEPSEEK_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${DEEPSEEK_KEY}`,
    },
    body,
  });
};

const qwen = createOpenAICompatible({
  name: "tech-ai-monkey",
  baseURL: BASE_URL,
  apiKey: process.env.OPENAI_COMPAT_API_KEY ?? "",
  fetch: fetchWithQuotaFallback,
}).chatModel(MODEL_ID);

console.log(`[agent] ${AGENT_CORE_CODENAME} -> modell: ${MODEL_ID} (${BASE_URL})`);

export default defineAgent({
  model: qwen,
  modelContextWindowTokens: contextTokens,
});
