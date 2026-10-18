import { defineTool } from "eve/tools";
import { z } from "zod";
import { elapsedSeconds, generateImage, hasPrivateImageProvider } from "../lib/imagegen";

export default defineTool({
  description:
    "Create a new picture from a text description. Use when the user asks for an image, illustration, logo idea, diagram-like artwork or a photo-style visual. Returns a markdown image link that the chat renders inline.",
  inputSchema: z.object({
    prompt: z
      .string()
      .min(3)
      .describe(
        "What to draw, in English for best results, e.g. 'a red panda developer at a laptop, flat illustration style'",
      ),
    width: z.number().int().min(256).max(1536).optional().describe("Width in pixels (default 1024, rounded to 64)"),
    height: z.number().int().min(256).max(1536).optional().describe("Height in pixels (default 1024, rounded to 64)"),
    seed: z.number().int().optional().describe("Same seed + prompt gives a similar image"),
  }),
  async execute(input, _ctx) {
    const started = Date.now();
    const result = await generateImage({
      prompt: input.prompt,
      width: input.width,
      height: input.height,
      seed: input.seed,
    });

    return {
      ...result,
      tookSeconds: Number(elapsedSeconds(started)),
      instructions:
        "Show the image by putting the markdown value on its own line in your answer, then describe briefly what was made.",
      ...(hasPrivateImageProvider()
        ? {}
        : {
            privacyNote:
              "Ingen IMAGE_GEN_API_KEY er satt, så ledeteksten ble sendt til den gratis tjenesten pollinations.ai. Ikke bruk den til bilder med private detaljer.",
          }),
    };
  },
});
