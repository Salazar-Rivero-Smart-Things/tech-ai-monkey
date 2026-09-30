import { defineAgent } from "eve";

// Cloud model, routed through the Vercel AI Gateway (no local Ollama needed).
// We use a free model so it works without paid credits. To use a premium model
// (e.g. "openai/gpt-5.5"), add credits at https://vercel.com/ai-gateway and
// change the id below.
export default defineAgent({
  model: "poolside/laguna-s-2.1-free",
});
