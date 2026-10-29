import { NextResponse } from "next/server";
import { resolveApiCaller } from "@/lib/api-caller";

// ---------------------------------------------------------------------------
// GET /v1/models — OpenAI-compatible model listing.
//
// VS Code's "Custom Endpoint" provider calls this when you configure a base URL
// instead of listing models yourself. Anything that speaks the OpenAI API can
// use it to discover what this instance offers.
//
// There is exactly one model: the Tech AI monkey agent. Its underlying LLM is
// chosen server-side (DEEPSEEK_API_KEY or the Vercel AI Gateway), so it is not
// something the caller can pick per request.
// ---------------------------------------------------------------------------

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Stable creation date so clients do not see the model "change" every call. */
const CREATED = 1_767_225_600; // 2026-01-01T00:00:00Z

const MODELS = [
  {
    id: "tech-ai-monkey",
    object: "model",
    version: "v2.0.1",
    core: "ollama-local",
    created: CREATED,
    owned_by: "tech-ai",
  },
  {
    id: "tech-ai-monkey-v2.0.1",
    object: "model",
    version: "v2.0.1",
    core: "ollama-local",
    created: CREATED,
    owned_by: "tech-ai",
  },
  {
    id: "tech-ai-monkey-v2",
    object: "model",
    version: "v2.0.1",
    core: "ollama-local",
    created: CREATED,
    owned_by: "tech-ai",
  },
];

export async function GET(request: Request) {
  const caller = await resolveApiCaller(request);
  if (!caller) {
    return NextResponse.json(
      {
        error: {
          message:
            "Invalid API key. Create one under Dashboard → API keys and send it as: Authorization: Bearer tai_...",
          type: "invalid_request_error",
          param: null,
          code: "invalid_api_key",
        },
      },
      { status: 401 },
    );
  }

  return NextResponse.json({ object: "list", data: MODELS });
}
