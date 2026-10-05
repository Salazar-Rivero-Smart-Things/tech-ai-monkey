import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { defineAgent } from "eve";

// ---------------------------------------------------------------------------
// Modellvalg
//
// Rekkefølge – første som er konfigurert vinner:
//
//   1. AGENT_MODEL        Ren modellstreng, f.eks. "openai/gpt-5.4-fast".
//                         Rutes automatisk via Vercel AI Gateway (bruker
//                         AI_GATEWAY_API_KEY / VERCEL_OIDC_TOKEN). Se alle
//                         modellene: curl -s https://ai-gateway.vercel.sh/v1/models
//
//   2. OPENAI_COMPAT_*    Hvilken som helst OpenAI-kompatibel leverandør – Groq,
//                         Cerebras, OpenRouter, Together, vLLM … Alt du trenger
//                         er baseURL + modell-id + API-nøkkel:
//                           OPENAI_COMPAT_BASE_URL=https://api.groq.com/openai/v1
//                           OPENAI_COMPAT_MODEL=llama-3.3-70b-versatile
//                           OPENAI_COMPAT_API_KEY=gsk_...
//                           OPENAI_COMPAT_CONTEXT_TOKENS=131072   (valgfritt)
//
//   3. OLLAMA_MODEL       Lokal Ollama (snarvei), f.eks. "llama3.1:8b".
//                         Ollama ignorerer API-nøkkelen, men klienten krever en.
//
//   4. DEEPSEEK_API_KEY   DeepSeek direkte ("deepseek-chat").
//                         Hent/roter: https://platform.deepseek.com/api_keys
//
//   5. (ingenting satt)   Gratis fallback via AI Gateway.
//
// SIKKERHET: nøkler skal ligge i `.env` (git-ignorert), ALDRI her.
// ---------------------------------------------------------------------------

/** Heltall fra miljøvariabel hvis positivt, ellers fallback. */
function positiveInt(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

// 1) AI Gateway – ren modellstreng (kjenner sin egen metadata).
const gatewayModel = process.env.AGENT_MODEL?.trim() || null;

// 2) Generisk OpenAI-kompatibel leverandør.
const compatModel = process.env.OPENAI_COMPAT_MODEL?.trim() || null;
const compatBaseUrl = process.env.OPENAI_COMPAT_BASE_URL ?? "http://127.0.0.1:11434/v1";
const compat = compatModel
  ? createOpenAICompatible({
      name: process.env.OPENAI_COMPAT_NAME?.trim() || "openai-compat",
      baseURL: compatBaseUrl,
      apiKey: process.env.OPENAI_COMPAT_API_KEY || "not-needed",
    }).chatModel(compatModel)
  : null;

// 3) Ollama-snarvei (samme maskin).
const ollamaModel = process.env.OLLAMA_MODEL?.trim() || null;
const ollama = ollamaModel
  ? createOpenAICompatible({
      name: "ollama",
      baseURL: process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434/v1",
      apiKey: process.env.OLLAMA_API_KEY || "ollama",
    }).chatModel(ollamaModel)
  : null;

// 4) DeepSeek direkte.
const deepseekApiKey = process.env.DEEPSEEK_API_KEY;
const deepseek = deepseekApiKey
  ? createOpenAICompatible({
      name: "deepseek",
      baseURL: "https://api.deepseek.com/v1",
      apiKey: deepseekApiKey,
    }).chatModel("deepseek-chat")
  : null;

if (gatewayModel) {
  console.log(`[agent] modell: ${gatewayModel} (Vercel AI Gateway)`);
} else if (compat) {
  console.log(`[agent] modell: ${compatModel} (OpenAI-kompatibel via ${compatBaseUrl})`);
} else if (ollama) {
  console.log(`[agent] modell: ${ollamaModel} (lokal Ollama)`);
} else if (deepseek) {
  console.log("[agent] modell: deepseek-chat (direkte via DEEPSEEK_API_KEY)");
} else {
  console.log(
    "[agent] modell: poolside/laguna-s-2.1-free (Vercel AI Gateway – fallback)",
  );
}

export default defineAgent({
  model: gatewayModel ?? compat ?? ollama ?? deepseek ?? "poolside/laguna-s-2.1-free",
  // Modeller utenom AI Gateway mangler metadata, så kontekstvinduet må
  // deklareres eksplisitt – ellers nekter `eve build` å kompilere
  // compaction-steget. Gatewayen kjenner sitt eget vindu, så der står det
  // udefinert.
  modelContextWindowTokens: gatewayModel
    ? undefined
    : compat
      ? positiveInt(process.env.OPENAI_COMPAT_CONTEXT_TOKENS, 32_768)
      : ollama
        ? positiveInt(process.env.OLLAMA_CONTEXT_TOKENS, 8_192)
        : deepseek
          ? 65_536
          : undefined,
});

