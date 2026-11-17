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

const model = localEngine(MODEL_ID);

console.log(`[agent] ${AGENT_CORE_CODENAME} -> aktiv motor: ${MODEL_ID} på ${BASE_URL} (100 % lokal llama.cpp)`);

startSupervisor();

export default defineAgent({
  model: model as any,
  modelContextWindowTokens: 8192,
});
