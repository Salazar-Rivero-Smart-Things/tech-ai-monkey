import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { defineAgent } from "eve";

// ---------------------------------------------------------------------------
// Tech AI Monkey – Modellkjerne v2.0.0 (Monkey Argon / Qwen 3.8 Hybrid Core)
//
// Rekkefølge & hybrid ruting:
//   1. AGENT_MODEL        Ren modellstreng via Vercel AI Gateway
//                         (f.eks. "google/gemini-4-argon" eller "alibaba/qwen3.8-max-prime").
//   2. OPENAI_COMPAT_*    Qwen 3.8 ("qwen/qwen3.8-27b") eller annen OpenAI-kompatibel
//                         kjerne, med automatisk sanntids-failover til DeepSeek V3
//                         ("deepseek-chat") ved store kontekstvinduer eller 429/413-grenser.
//   3. OLLAMA_MODEL       Lokal Ollama-modell.
//   4. DEEPSEEK_API_KEY   DeepSeek direkte ("deepseek-chat").
//   5. Fallback           "poolside/laguna-s-2.1-free" via AI Gateway.
// ---------------------------------------------------------------------------

export const AGENT_VERSION = "v2.0.0";
export const AGENT_CORE_CODENAME = "Monkey Argon v2.0.0 (Qwen 3.8 Hybrid Core)";

/** Heltall fra miljøvariabel hvis positivt, ellers fallback. */
function positiveInt(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

const gatewayModel = process.env.AGENT_MODEL?.trim() || null;
const compatModel = process.env.OPENAI_COMPAT_MODEL?.trim() || null;
const compatBaseUrl = (process.env.OPENAI_COMPAT_BASE_URL ?? "http://127.0.0.1:11434/v1").replace(
  /\/+$/,
  "",
);
const compatApiKey = process.env.OPENAI_COMPAT_API_KEY || "not-needed";
const deepseekApiKey = process.env.DEEPSEEK_API_KEY?.trim() || null;

let primaryCooldownUntil = 0;

/**
 * Smart hybrid fetch: bruker primærmodellen (f.eks. Qwen 3.8 på Groq) for raske
 * kall, og ruter sømløst over til DeepSeek når konteksten er stor eller
 * primærleverandøren treffer rate-limit (429/413) eller nettverksfeil.
 */
const hybridFetch: typeof fetch = async (input, init) => {
  const rawBody = typeof init?.body === "string" ? init.body : "";
  const now = Date.now();

  const forwardToDeepSeek = async () => {
    if (!deepseekApiKey) {
      return fetch(input, init);
    }
    let rewrittenBody = rawBody;
    if (rawBody) {
      try {
        const parsed = JSON.parse(rawBody) as Record<string, unknown>;
        parsed.model = "deepseek-chat";
        if (typeof parsed.max_tokens === "number" && parsed.max_tokens > 8192) {
          parsed.max_tokens = 8192;
        }
        rewrittenBody = JSON.stringify(parsed);
      } catch {
        // behold eksisterende body
      }
    }
    const headers = new Headers(init?.headers);
    headers.set("authorization", `Bearer ${deepseekApiKey}`);
    headers.set("content-type", "application/json");
    return fetch("https://api.deepseek.com/v1/chat/completions", {
      ...init,
      headers,
      body: rewrittenBody,
    });
  };

  // Hvis Groq er på kort cooldown eller payloaden overstiger Groqs on-demand ITPM-grense (~26 KB),
  // ruter vi direkte til DeepSeek-kjernen så verktøy-løkker aldri feiler.
  if (deepseekApiKey && (now < primaryCooldownUntil || rawBody.length > 26_000)) {
    return forwardToDeepSeek();
  }

  let primaryInit = init;
  if (rawBody && compatBaseUrl.includes("groq.com")) {
    try {
      const parsed = JSON.parse(rawBody) as Record<string, unknown>;
      if (typeof parsed.max_tokens === "number" && parsed.max_tokens > 950) {
        parsed.max_tokens = 950;
        primaryInit = { ...init, body: JSON.stringify(parsed) };
      }
    } catch {
      // behold original init
    }
  }

  try {
    const res = await fetch(input, primaryInit);
    if (!res.ok && deepseekApiKey && (res.status === 429 || res.status === 413 || res.status >= 500 || res.status === 400)) {
      if (res.status === 429 || res.status === 413) {
        primaryCooldownUntil = Date.now() + 25_000;
      }
      return forwardToDeepSeek();
    }
    return res;
  } catch (err) {
    if (deepseekApiKey) {
      return forwardToDeepSeek();
    }
    throw err;
  }
};

const compat = compatModel
  ? createOpenAICompatible({
      name: process.env.OPENAI_COMPAT_NAME?.trim() || "monkey-argon-qwen",
      baseURL: compatBaseUrl,
      apiKey: compatApiKey,
      fetch: deepseekApiKey ? hybridFetch : undefined,
    }).chatModel(compatModel)
  : null;

const ollamaModel = process.env.OLLAMA_MODEL?.trim() || null;
const ollama = ollamaModel
  ? createOpenAICompatible({
      name: "ollama",
      baseURL: process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434/v1",
      apiKey: process.env.OLLAMA_API_KEY || "ollama",
    }).chatModel(ollamaModel)
  : null;

const deepseek = deepseekApiKey
  ? createOpenAICompatible({
      name: "deepseek",
      baseURL: "https://api.deepseek.com/v1",
      apiKey: deepseekApiKey,
    }).chatModel("deepseek-chat")
  : null;

if (gatewayModel) {
  console.log(`[agent] ${AGENT_CORE_CODENAME} -> modell: ${gatewayModel} (Vercel AI Gateway)`);
} else if (compat) {
  console.log(
    `[agent] ${AGENT_CORE_CODENAME} -> modell: ${compatModel} (${compatBaseUrl}${
      deepseekApiKey ? " + deepseek-chat hybrid failover" : ""
    })`,
  );
} else if (ollama) {
  console.log(`[agent] ${AGENT_CORE_CODENAME} -> modell: ${ollamaModel} (lokal Ollama)`);
} else if (deepseek) {
  console.log(`[agent] ${AGENT_CORE_CODENAME} -> modell: deepseek-chat (direkte via DEEPSEEK_API_KEY)`);
} else {
  console.log(
    `[agent] ${AGENT_CORE_CODENAME} -> modell: poolside/laguna-s-2.1-free (Vercel AI Gateway – fallback)`,
  );
}

export default defineAgent({
  model: gatewayModel ?? compat ?? ollama ?? deepseek ?? "poolside/laguna-s-2.1-free",
  modelContextWindowTokens: gatewayModel
    ? undefined
    : compat
      ? positiveInt(process.env.OPENAI_COMPAT_CONTEXT_TOKENS, 131_072)
      : ollama
        ? positiveInt(process.env.OLLAMA_CONTEXT_TOKENS, 8_192)
        : deepseek
          ? 65_536
          : undefined,
});


