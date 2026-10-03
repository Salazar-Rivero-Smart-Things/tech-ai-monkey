import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { defineAgent } from "eve";

// ---------------------------------------------------------------------------
// Modellvalg
//
// Foretrukket: DeepSeek via sitt OpenAI-kompatible API.
//   SIKKERHET: nøkkelen er en hemmelighet. Legg den i `.env` (git-ignorert),
//   ALDRI her. Fyll inn i rotmappas .env:
//       DEEPSEEK_API_KEY=sk-...
//   Hent / roter:  https://platform.deepseek.com/api_keys
//   Modell-id-er: "deepseek-chat" (V3) eller "deepseek-reasoner" (R1, tenking).
//
// Fallback: den gratis modellen via Vercel AI Gateway, så agenten fortsatt
//   svarer helt til en DeepSeek-nøkkel er satt (krever ingen betalte kreditter).
// ---------------------------------------------------------------------------

const deepseekApiKey = process.env.DEEPSEEK_API_KEY;

const deepseek = deepseekApiKey
  ? createOpenAICompatible({
      name: "deepseek",
      baseURL: "https://api.deepseek.com/v1",
      apiKey: deepseekApiKey,
    }).chatModel("deepseek-chat")
  : null;

if (deepseek) {
  console.log("[agent] modell: deepseek-chat (direkte via DEEPSEEK_API_KEY)");
} else {
  console.log(
    "[agent] modell: poolside/laguna-s-2.1-free (Vercel AI Gateway – fallback, DEEPSEEK_API_KEY mangler)",
  );
}

export default defineAgent({
  model: deepseek ?? "poolside/laguna-s-2.1-free",
});

