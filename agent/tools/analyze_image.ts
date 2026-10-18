import { defineTool } from "eve/tools";
import { z } from "zod";
import {
  IMAGE_FORMATS,
  describeFrames,
  findUpload,
  makeTempDir,
  removeTempDir,
  visionEndpoint,
} from "../lib/video";

export default defineTool({
  description:
    "Look at an image the user attached in the chat (png, jpg, jpeg, webp, gif). Returns what the image shows, including readable text such as error messages. Use whenever the user uploads a screenshot or photo.",
  inputSchema: z.object({
    file: z
      .string()
      .optional()
      .describe("File name of the uploaded image, e.g. 'skjermbilde.png' or '1730390000-skjermbilde.png'"),
    question: z.string().optional().describe("What to look for in the image"),
  }),
  async execute(input, _ctx) {
    const query = input.file?.trim();
    if (!query) throw new Error("Oppgi file – navnet på bildet brukeren lastet opp.");

    const upload = await findUpload(query);
    if (!upload) {
      throw new Error(
        `Fant ingen opplastet fil som heter "${query}". Be brukeren laste opp bildet på nytt med +-knappen.`,
      );
    }
    if (!(IMAGE_FORMATS as readonly string[]).includes(upload.format)) {
      throw new Error(
        `"${upload.file}" er ikke et bilde (${upload.format}). Bruk analyze_video for video.`,
      );
    }

    const endpoint = visionEndpoint();
    if (!endpoint) {
      throw new Error("Ingen bildemodell er konfigurert (VIDEO_VISION_* mangler).");
    }

    const dir = await makeTempDir();
    try {
      const description = await describeFrames(
        [{ path: upload.path, atSeconds: 0, fileName: upload.file }],
        { question: input.question, title: upload.originalName, mode: "image" },
      );
      return {
        file: upload.originalName,
        kind: "image",
        sizeKb: Math.round(upload.sizeBytes / 1024),
        description: description?.text ?? null,
        visionModel: description?.model ?? null,
      };
    } finally {
      await removeTempDir(dir);
    }
  },
});
