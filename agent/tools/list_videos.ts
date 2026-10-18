import { defineTool } from "eve/tools";
import { z } from "zod";
import {
  SANDBOX_VIDEOS_DIR,
  ffmpegTools,
  listHostVideos,
  videosDir,
} from "../lib/video";

export default defineTool({
  description:
    "List the video files the agent can analyse: the files the owner has dropped into the server's video library, plus anything already inside the sandbox's videos folder. Use before analyze_video when the user refers to a video by name, or when they ask which videos are available.",
  inputSchema: z.object({}),
  async execute(_input, ctx) {
    const tools = await ffmpegTools();
    const videos = await listHostVideos();

    let inSandbox: string[] | null = null;
    let sandboxError: string | null = null;
    try {
      const sandbox = await ctx.getSandbox();
      const result = await sandbox.run({
        command: `ls -1 /workspace/${SANDBOX_VIDEOS_DIR} 2>/dev/null || true`,
      });
      inSandbox = result.stdout
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
    } catch (error) {
      sandboxError = error instanceof Error ? error.message : String(error);
    }

    return {
      libraryDir: videosDir(),
      ffmpeg: tools,
      available: videos.map((video) => ({
        file: video.file,
        title: video.title,
        format: video.format,
        sizeMb: Math.round(video.sizeBytes / 1024 / 1024),
        modifiedAt: video.modifiedAt,
      })),
      alreadyInSandbox: inSandbox,
      ...(sandboxError ? { sandboxError } : {}),
      nextStep:
        videos.length > 0
          ? "Call analyze_video with the file name (or a /workspace path) to get metadata, stills and a description of what happens in the video."
          : `The library is empty. Tell the user to drop the video (${videosDir()}) on the server, or upload it into /workspace, then call this tool again.`,
      note: "analyze_video samples stills with FFmpeg on the host and describes them with the configured vision model. Stills are copied to /workspace/videos/frames/<name>/.",
    };
  },
});
