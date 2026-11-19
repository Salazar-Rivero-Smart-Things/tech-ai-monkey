import { createOpenAI } from "@ai-sdk/openai";
import { defineAgent } from "eve";

import { startSupervisor } from "./lib/supervisor";

// ---------------------------------------------------------------------------
// Tech AI Monkey – tech-ai.tech monkey v2.1
// 100 % uavhengig lokal llama.cpp motor (GPU-akselerert via Vulkan/CUDA).
// Kjører uten eksterne skylleverandører eller bakdører.
// ---------------------------------------------------------------------------

export const AGENT_VERSION = "v2.1";
export const AGENT_CORE_CODENAME = "tech-ai.tech monkey v2.1 (llama.cpp)";

const BASE_URL =
  process.env.LOCAL_AI_BASE_URL?.trim() ||
  process.env.OPENAI_COMPAT_BASE_URL?.trim() ||
  "http://127.0.0.1:8080/v1";

const MODEL_ID =
  process.env.LOCAL_AI_MODEL?.trim() ||
  process.env.OPENAI_MODEL?.trim() ||
  "default";

const localEngine = createOpenAI({
  baseURL: BASE_URL,
  apiKey: process.env.LOCAL_AI_API_KEY?.trim() || "not-needed",
});

// llama.cpp exposes the OpenAI *chat completions* API (/v1/chat/completions).
// The provider's default entry point targets the Responses API (/v1/responses),
// whose streamed events llama-server does not fully implement, so every model
// call failed schema validation ("MODEL_CALL_FAILED"). `.chat()` pins the
// provider to chat completions, which llama-server fully supports.
const model = localEngine.chat(MODEL_ID);

console.log(`[agent] ${AGENT_CORE_CODENAME} -> aktiv motor: ${MODEL_ID} på ${BASE_URL} (100 % lokal llama.cpp)`);

startSupervisor();

// The eve system prompt (tools + skills) alone is ~7.6k tokens, so an 8k window
// left almost no room for the conversation and turns died once history grew.
// llama-server is started with -c 16384 in start-tech-ai-monkey.bat; keep these
// two in sync.
export const MODEL_CONTEXT_WINDOW_TOKENS = 16384;

export default defineAgent({
  model: model as any,
  modelContextWindowTokens: MODEL_CONTEXT_WINDOW_TOKENS,
});
