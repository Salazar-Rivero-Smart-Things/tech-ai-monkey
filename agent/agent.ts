import { defineAgent } from "eve";

// Cloud model through the Vercel AI Gateway — fast, no local GPU/Ollama needed.
// The "...-free" models cost nothing (no paid credits required).
// To use a paid model later, change the id (e.g. "openai/gpt-5.4").
//
// The agent needs a gateway credential to call this model:
//   - Local dev: `vercel link` + `vercel env pull .env.local --yes`
//     (writes VERCEL_OIDC_TOKEN), or set AI_GATEWAY_API_KEY in .env.local.
//   - 24/7 server: set AI_GATEWAY_API_KEY in .env.agent (see deploy/).
export default defineAgent({
  model: "poolside/laguna-s-2.1-free",
});
