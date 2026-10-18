import { defineTool } from "eve/tools";
import { z } from "zod";
import {
  DEFAULT_FRAME_COUNT,
  MAX_FRAME_COUNT,
  copyFramesToSandbox,
  describeFrames,
  extractFrames,
  ffmpegTools,
  findHostVideo,
  makeTempDir,
  probeVideo,
  pullSandboxVideo,
  removeTempDir,
  visionEndpoint,
} from "../lib/video";

function secondsLabel(value: number): string {
  const total = Math.max(0, Math.round(value));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

export default defineTool({
  description:
    "Watch a video: reads it with FFmpeg, reports duration/codecs/resolution, samples stills and describes what actually happens in them with the vision model. Use whenever the user asks what a video shows, asks you to summarise a recording, wants on-screen text read out, or asks about something that happens at a point in a video. Accepts a file from the server video library or a path inside /workspace.",
  inputSchema: z.object({
    file: z
      .string()
      .optional()
      .describe("File name in the server video library, e.g. 'demo.mp4' (see list_videos)"),
    path: z
      .string()
      .optional()
      .describe("Absolute path inside the sandbox, e.g. '/workspace/demo.mp4'. Use instead of file."),
    question: z
      .string()
      .optional()
      .describe("What to look for, e.g. 'hva sier feilmeldingen?' or 'hvilke knapper trykkes?'"),
    frames: z
      .number()
      .int()
      .min(1)
      .max(MAX_FRAME_COUNT)
      .optional()
      .describe(`How many stills to sample (default ${DEFAULT_FRAME_COUNT}, max ${MAX_FRAME_COUNT})`),
    startSeconds: z.number().min(0).optional().describe("Only look from this timestamp (seconds)"),
    endSeconds: z.number().min(0).optional().describe("Only look until this timestamp (seconds)"),
    describe: z
      .boolean()
      .optional()
      .describe("Set false to only get metadata and stills, without calling the vision model"),
    keepFrames: z
      .boolean()
      .optional()
      .describe("Copy the stills into /workspace/videos/frames/ as well (default false)"),
  }),
  async execute(input, ctx) {
    const tools = await ffmpegTools();
    if (!tools.ffmpeg || !tools.ffprobe) {
      throw new Error(
        "FFmpeg mangler på serveren (ffmpeg og ffprobe må være installert) — kan ikke lese video.",
      );
    }

    const sandbox = await ctx.getSandbox().catch(() => null);
    const tempDir = await makeTempDir();

    try {
      let videoPath: string;
      let slug: string;
      let title: string;
      let source: string;

      if (input.path?.trim()) {
        const sandboxPath = input.path.trim();
        if (!sandboxPath.startsWith("/")) {
          throw new Error("path må være en absolutt sti, f.eks. '/workspace/demo.mp4'");
        }
        if (!sandbox) throw new Error(`ingen sandbox tilgjengelig for å lese ${sandboxPath}`);
        const pulled = await pullSandboxVideo(sandbox, sandboxPath, tempDir);
        videoPath = pulled.path;
        title = sandboxPath.split("/").pop() ?? sandboxPath;
        slug = title.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9-_]+/g, "-").toLowerCase() || "video";
        source = `sandbox:${sandboxPath} (${(pulled.sizeBytes / 1024 / 1024).toFixed(0)} MB)`;
      } else {
        const query = input.file?.trim();
        if (!query) {
          throw new Error("Oppgi enten file (fra videobiblioteket) eller path (inne i /workspace).");
        }
        const video = await findHostVideo(query);
        if (!video) {
          throw new Error(
            `Fant ingen video som heter "${query}". Kall list_videos for å se hva som ligger i biblioteket.`,
          );
        }
        videoPath = video.path;
        slug = video.slug;
        title = video.file;
        source = video.path;
      }

      const info = await probeVideo(videoPath);
      const frames = await extractFrames(videoPath, {
        count: input.frames ?? DEFAULT_FRAME_COUNT,
        startSeconds: input.startSeconds,
        endSeconds: input.endSeconds,
        durationSeconds: info.durationSeconds,
        outDir: `${tempDir}/frames`,
      });

      const hasVision = Boolean(visionEndpoint());
      let description: { text: string; model: string } | null = null;
      let descriptionError: string | null = null;
      if (input.describe !== false && hasVision) {
        try {
          description = await describeFrames(frames, {
            question: input.question,
            durationSeconds: info.durationSeconds,
            title,
          });
        } catch (error) {
          descriptionError = error instanceof Error ? error.message : String(error);
        }
      }

      let sandboxFrames: string[] = [];
      let sandboxError: string | null = null;
      if (input.keepFrames === true && sandbox) {
        try {
          sandboxFrames = await Promise.race([
            copyFramesToSandbox(sandbox, slug, frames),
            new Promise<string[]>((_, reject) =>
              setTimeout(() => reject(new Error("tidsavbrudd ved kopiering til sandkassen")), 20_000),
            ),
          ]);
        } catch (error) {
          sandboxError = error instanceof Error ? error.message : String(error);
        }
      }

      return {
        file: title,
        source,
        metadata: {
          duration: info.durationSeconds != null ? secondsLabel(info.durationSeconds) : null,
          durationSeconds: info.durationSeconds,
          container: info.container,
          sizeMb: Math.round((info.sizeBytes || 0) / 1024 / 1024),
          bitrateKbps: info.overallBitrateKbps,
          video: info.video,
          audio: info.audio,
        },
        frames: frames.map((frame) => ({
          at: secondsLabel(frame.atSeconds),
          atSeconds: Number(frame.atSeconds.toFixed(2)),
          sandboxPath: sandboxFrames.find((path) => path.endsWith(frame.fileName)) ?? null,
        })),
        description: description?.text ?? null,
        visionModel: description?.model ?? null,
        ...(descriptionError ? { descriptionError } : {}),
        ...(sandboxError ? { sandboxError } : {}),
        ...(hasVision
          ? {}
          : {
              visionMissing:
                "Ingen bildemodell er konfigurert (VIDEO_VISION_MODEL eller OPENAI_COMPAT_*), så du får bare metadata og stillbilder.",
            }),
        note: input.keepFrames
          ? "The description above is computed on the host. Stills were also copied to /workspace/videos/frames/<name>/ as binary JPEGs — do NOT open them with read_file (it fails on binary data); the description already contains what they show."
          : "The description above is computed on the host; no files were written to the sandbox.",
      };
    } finally {
      await removeTempDir(tempDir);
    }
  },
});
