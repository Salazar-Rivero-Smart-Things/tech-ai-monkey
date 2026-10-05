#!/usr/bin/env node
/**
 * Mål hvor rask og kapabel en modell er for agenten.
 *
 * Mot Vercel AI Gateway (standard):
 *   AI_GATEWAY_API_KEY=... npm run bench
 *
 * Mot en hvilken som helst OpenAI-kompatibel leverandør:
 *   BENCH_BASE_URL=https://api.deepseek.com/v1 BENCH_API_KEY=$DEEPSEEK_API_KEY \
 *     BENCH_MODELS=deepseek-chat node scripts/model-bench.mjs
 *
 * Variabler:
 *   BENCH_BASE_URL    endepunkt (standard: https://ai-gateway.vercel.sh/v1)
 *   BENCH_API_KEY     nøkkel (faller tilbake til AI_GATEWAY_API_KEY)
 *   BENCH_MODELS      kommaseparert liste (standard: et lite, raskt utvalg)
 *   BENCH_RUNS        kjøringer per modell (standard: 2)
 *   BENCH_TIMEOUT_MS  timeout per kall (standard: 60000)
 */

import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Last rot-`.env` automatisk, så `npm run bench` virker uten ekstra oppsett.
for (const rel of ["../.env", "../.env.local"]) {
  const envPath = fileURLToPath(new URL(rel, import.meta.url));
  if (existsSync(envPath)) {
    try {
      process.loadEnvFile(envPath); // overstyrer ikke variabler som allerede er satt
    } catch {
      // Eldre Node eller ugyldig fil – ignorer; variabler kan settes i shell i stedet.
    }
  }
}

const baseUrl = (
  process.env.BENCH_BASE_URL ??
  process.env.OPENAI_COMPAT_BASE_URL ??
  "https://ai-gateway.vercel.sh/v1"
).replace(/\/+$/, "");
const apiKey =
  process.env.BENCH_API_KEY ?? process.env.OPENAI_COMPAT_API_KEY ?? process.env.AI_GATEWAY_API_KEY ?? "";
const runs = Math.max(1, Number(process.env.BENCH_RUNS ?? 2));
const timeoutMs = Number(process.env.BENCH_TIMEOUT_MS ?? 60_000);

// Standard-modeller: bruk den konfigurerte leverandørens modell hvis satt,
// ellers et lite, raskt utvalg fra AI Gateway.
const defaultModels = process.env.OPENAI_COMPAT_MODEL
  ? [process.env.OPENAI_COMPAT_MODEL.trim()]
  : [
      "openai/gpt-5.4-mini-fast",
      "openai/gpt-5.4-fast",
      "google/gemini-2.5-flash",
      "meta/llama-4-scout",
      "poolside/laguna-s-2.1-free",
    ];

const models = (process.env.BENCH_MODELS ?? defaultModels.join(","))
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const TOOLS = [
  {
    type: "function",
    function: {
      name: "get_weather",
      description: "Get the current weather for a city",
      parameters: {
        type: "object",
        properties: { city: { type: "string" } },
        required: ["city"],
      },
    },
  },
];

async function chat(model, { tools = false, maxTokens = 128 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = performance.now();
  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        model,
        messages: tools
          ? [{ role: "user", content: "What is the weather in Oslo? Use the tool." }]
          : [{ role: "user", content: "Count from 1 to 20, comma separated, nothing else." }],
        max_tokens: maxTokens,
        ...(tools ? { tools: TOOLS } : {}),
      }),
    });
    const ms = performance.now() - started;
    const body = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, ms, body };
  } catch (err) {
    return { ok: false, status: 0, ms: performance.now() - started, error: err.message };
  } finally {
    clearTimeout(timer);
  }
}

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

console.log(`Endepunkt: ${baseUrl}`);
console.log(`Nøkkel:    ${apiKey ? `${apiKey.slice(0, 6)}…${apiKey.slice(-4)}` : "(ingen)"}`);
console.log(`Modeller:  ${models.length}   Kjøringer: ${runs}\n`);

if (!apiKey) {
  console.log(
    "⚠  Ingen API-nøkkel funnet. Sett AI_GATEWAY_API_KEY i rot-`.env`, eller kjør:\n" +
      "   BENCH_BASE_URL=... BENCH_API_KEY=... npm run bench\n",
  );
}

const rows = [];
for (const model of models) {
  await chat(model, { maxTokens: 8 }); // varm opp

  const times = [];
  let tokensPerSec = null;
  let error = null;

  for (let i = 0; i < runs; i++) {
    const r = await chat(model);
    if (!r.ok) {
      error = r.body?.error?.message ?? r.error ?? `HTTP ${r.status}`;
      break;
    }
    times.push(r.ms);
    const usage = r.body?.usage;
    if (usage?.completion_tokens && r.ms > 0) {
      tokensPerSec = usage.completion_tokens / (r.ms / 1000);
    }
  }

  let toolOk = null;
  if (!error) {
    const t = await chat(model, { tools: true });
    const calls = t.body?.choices?.[0]?.message?.tool_calls;
    toolOk = t.ok && Array.isArray(calls) && calls.length > 0 && /get_weather/.test(JSON.stringify(calls));
  }

  rows.push({ model, ms: times.length ? median(times) : null, tps: tokensPerSec, toolOk, error });
  if (error) {
    console.log(`✗ ${model}  -> ${String(error).slice(0, 80)}`);
  } else {
    console.log(
      `✓ ${model}  ${Math.round(median(times))} ms   ${
        tokensPerSec ? `${Math.round(tokensPerSec)} tok/s` : "? tok/s"
      }   tools=${toolOk ? "ja" : "NEI"}`,
    );
  }
}

console.log("\n--- rangert etter latens (raskest først) ---");
rows
  .filter((r) => !r.error)
  .sort((a, b) => a.ms - b.ms)
  .forEach((r, i) =>
    console.log(
      `${i + 1}. ${r.model}  ${Math.round(r.ms)} ms  ${
        r.tps ? `${Math.round(r.tps)} tok/s` : ""
      }  tools=${r.toolOk ? "ja" : "nei"}`,
    ),
  );

const failures = rows.filter((r) => r.error);
if (failures.length) {
  console.log("\nFeilet:");
  for (const r of failures) console.log(` - ${r.model}: ${r.error}`);
  if (failures.some((r) => /\b(401|403)\b|auth/i.test(String(r.error)))) {
    console.log(
      "\nTips: 401/403 = ugyldig eller manglende nøkkel. Lag ny AI Gateway-nøkkel på\n" +
        "https://vercel.com/dashboard → AI Gateway → API keys, eller kjør med\n" +
        "BENCH_BASE_URL + BENCH_API_KEY for en annen leverandør (Groq, DeepSeek, Ollama …).",
    );
  }
}
