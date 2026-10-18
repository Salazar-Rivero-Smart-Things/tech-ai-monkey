import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, join, resolve } from "node:path";
import { promisify } from "node:util";
import type { SandboxSession } from "eve/sandbox";
import { slugify } from "./skills-store";

// ---------------------------------------------------------------------------
// Host-side video analysis with FFmpeg.
//
// The sandbox image has no FFmpeg, and decoding video there would mean pulling
// it across the VM boundary first. Instead everything happens on the host:
//
//   <repo>/videos/demo.mp4           (owner drops the file here)
//        │  ffprobe  → duration, codecs, resolution, frame rate
//        │  ffmpeg   → evenly spaced stills (max 1024 px wide)
//        ▼
//   vision model (same OpenAI-compatible endpoint as the agent's model)
//        → "at 0:05 the terminal shows ... at 0:12 a dialog opens ..."
//
// The extracted stills are also copied into /workspace/videos/frames/<slug>/
// so the agent (or the user through an artifact) can open them.
//
// The folder is git-ignored: videos are large and often private.
// Override the location with EVE_VIDEOS_DIR.
// ---------------------------------------------------------------------------

const execFileAsync = promisify(execFile);

/** File extensions the library accepts, without the dot. */
export const VIDEO_FORMATS = [
  "mp4",
  "m4v",
  "mov",
  "mkv",
  "webm",
  "avi",
  "mpg",
  "mpeg",
  "ts",
  "mts",
  "m2ts",
  "3gp",
  "ogv",
] as const;

/** Where extracted stills land inside the sandbox, relative to /workspace. */
export const SANDBOX_VIDEOS_DIR = "videos";

/** Image formats the chat accepts as attachments. */
export const IMAGE_FORMATS = ["png", "jpg", "jpeg", "webp", "gif"] as const;

/** Refuse to load anything bigger than this into memory from the sandbox. */
export const MAX_SANDBOX_VIDEO_BYTES = 512 * 1024 * 1024;

/** Default number of stills sampled from a video. */
export const DEFAULT_FRAME_COUNT = 8;

/** Upper bound for stills in one request (model context and upload size). */
export const MAX_FRAME_COUNT = 16;

export interface HostVideo {
  slug: string;
  title: string;
  file: string;
  format: string;
  path: string;
  sizeBytes: number;
  modifiedAt: string;
}

export interface VideoStreamInfo {
  codec: string | null;
  width: number | null;
  height: number | null;
  fps: number | null;
  bitrateKbps: number | null;
}

export interface VideoInfo {
  durationSeconds: number | null;
  sizeBytes: number;
  container: string | null;
  overallBitrateKbps: number | null;
  video: VideoStreamInfo | null;
  audio: { codec: string | null; channels: number | null; sampleRate: number | null } | null;
}

export interface ExtractedFrame {
  /** Absolute path to the JPEG on the host. */
  path: string;
  /** Timestamp in seconds inside the video. */
  atSeconds: number;
  fileName: string;
}

export interface FrameDescription {
  text: string;
  model: string;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Walk up from `start` looking for the repo root (has `agent/` and `web/`). */
function findRepoRoot(start: string): string | null {
  let dir = resolve(start);
  for (let i = 0; i < 6; i += 1) {
    if (existsSync(join(dir, "agent")) && existsSync(join(dir, "web"))) return dir;
    const parent = resolve(dir, "..");
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

/** The folder the owner drops videos into. */
export function videosDir(): string {
  const override = process.env.EVE_VIDEOS_DIR?.trim();
  if (override) return resolve(override);
  const root = findRepoRoot(process.cwd()) ?? process.cwd();
  return join(root, "videos");
}

/** Folder the web chat writes uploaded attachments into. */
export function uploadsDir(): string {
  const override = process.env.EVE_UPLOADS_DIR?.trim();
  if (override) return resolve(override);
  const root = findRepoRoot(process.cwd()) ?? process.cwd();
  return join(root, "uploads");
}

export interface UploadedFile {
  /** Stored file name, e.g. "1730390000-skjermbilde.png". */
  file: string;
  /** Original name from the user's computer. */
  originalName: string;
  format: string;
  kind: "image" | "video" | "other";
  path: string;
  sizeBytes: number;
}

/** Find an uploaded attachment by stored name, original name or slug. */
export async function findUpload(query: string): Promise<UploadedFile | null> {
  const needle = query.trim().toLowerCase();
  if (!needle) return null;
  const base = needle.split("/").pop() ?? needle;

  let entries: string[];
  try {
    entries = await readdir(uploadsDir());
  } catch {
    return null;
  }

  for (const file of entries) {
    const lower = file.toLowerCase();
    const format = extname(file).slice(1).toLowerCase();
    const matches =
      lower === base ||
      lower.includes(base) ||
      lower.replace(/^\d+-/, "") === base;
    if (!matches) continue;
    const path = join(uploadsDir(), file);
    try {
      const info = await stat(path);
      if (!info.isFile()) continue;
      const kind: UploadedFile["kind"] = (IMAGE_FORMATS as readonly string[]).includes(format)
        ? "image"
        : (VIDEO_FORMATS as readonly string[]).includes(format)
          ? "video"
          : "other";
      return {
        file,
        originalName: file.replace(/^\d+-/, ""),
        format,
        kind,
        path,
        sizeBytes: info.size,
      };
    } catch {
      // ignore unreadable entries
    }
  }
  return null;
}

function titleFromFile(file: string): string {
  const base = file.replace(/\.[^.]+$/, "");
  return base.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim() || base;
}

/** True when FFmpeg and FFprobe are on PATH. */
export async function ffmpegTools(): Promise<{ ffmpeg: boolean; ffprobe: boolean }> {
  const probe = async (binary: string) => {
    try {
      await execFileAsync(binary, ["-version"], { timeout: 10_000 });
      return true;
    } catch {
      return false;
    }
  };
  const [ffmpeg, ffprobe] = await Promise.all([probe("ffmpeg"), probe("ffprobe")]);
  return { ffmpeg, ffprobe };
}

export async function listHostVideos(): Promise<HostVideo[]> {
  const dir = videosDir();
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return [];
  }

  const videos: HostVideo[] = [];
  for (const file of entries) {
    const format = extname(file).slice(1).toLowerCase();
    if (!(VIDEO_FORMATS as readonly string[]).includes(format)) continue;
    const path = join(dir, file);
    try {
      const info = await stat(path);
      if (!info.isFile()) continue;
      videos.push({
        slug: slugify(titleFromFile(file)),
        title: titleFromFile(file),
        file,
        format,
        path,
        sizeBytes: info.size,
        modifiedAt: info.mtime.toISOString(),
      });
    } catch {
      // Unreadable entry: skip it instead of failing the whole listing.
    }
  }
  return videos.sort((a, b) => a.title.localeCompare(b.title));
}

/** Resolve a loose name ("demo", "demo.mp4", "demo-mp4") to one video. */
export async function findHostVideo(query: string): Promise<HostVideo | null> {
  const needle = query.trim().toLowerCase();
  if (!needle) return null;
  const videos = await listHostVideos();
  return (
    videos.find((video) => video.file.toLowerCase() === needle) ??
    videos.find((video) => video.slug === needle) ??
    videos.find((video) => video.title.toLowerCase() === needle) ??
    videos.find((video) => video.title.toLowerCase().includes(needle)) ??
    null
  );
}

function numberOrNull(value: unknown): number | null {
  const n = typeof value === "string" ? Number(value) : typeof value === "number" ? value : NaN;
  return Number.isFinite(n) ? n : null;
}

function parseRate(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const [num, den] = value.split("/").map(Number);
  if (!Number.isFinite(num) || !Number.isFinite(den) || den === 0) return numberOrNull(value);
  return Math.round((num / den) * 100) / 100;
}

export async function probeVideo(path: string): Promise<VideoInfo> {
  let stdout: string;
  try {
    const result = await execFileAsync(
      "ffprobe",
      [
        "-v",
        "error",
        "-print_format",
        "json",
        "-show_format",
        "-show_streams",
        path,
      ],
      { timeout: 60_000, maxBuffer: 8 * 1024 * 1024 },
    );
    stdout = result.stdout;
  } catch (error) {
    throw new Error(`ffprobe kunne ikke lese videoen: ${errorMessage(error)}`);
  }

  const data = JSON.parse(stdout) as {
    format?: Record<string, unknown>;
    streams?: Array<Record<string, unknown>>;
  };
  const format = data.format ?? {};
  const streams = data.streams ?? [];
  const videoStream = streams.find((stream) => stream.codec_type === "video");
  const audioStream = streams.find((stream) => stream.codec_type === "audio");

  return {
    durationSeconds: numberOrNull(format.duration) ?? numberOrNull(videoStream?.duration),
    sizeBytes: numberOrNull(format.size) ?? 0,
    container: typeof format.format_name === "string" ? format.format_name : null,
    overallBitrateKbps: (() => {
      const bits = numberOrNull(format.bit_rate);
      return bits ? Math.round(bits / 1000) : null;
    })(),
    video: videoStream
      ? {
          codec: typeof videoStream.codec_name === "string" ? videoStream.codec_name : null,
          width: numberOrNull(videoStream.width),
          height: numberOrNull(videoStream.height),
          fps: parseRate(videoStream.avg_frame_rate) ?? parseRate(videoStream.r_frame_rate),
          bitrateKbps: (() => {
            const bits = numberOrNull(videoStream.bit_rate);
            return bits ? Math.round(bits / 1000) : null;
          })(),
        }
      : null,
    audio: audioStream
      ? {
          codec: typeof audioStream.codec_name === "string" ? audioStream.codec_name : null,
          channels: numberOrNull(audioStream.channels),
          sampleRate: numberOrNull(audioStream.sample_rate),
        }
      : null,
  };
}

export async function makeTempDir(prefix = "eve-video-"): Promise<string> {
  return mkdtemp(join(tmpdir(), prefix));
}

export async function removeTempDir(dir: string): Promise<void> {
  await rm(dir, { recursive: true, force: true }).catch(() => {});
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Extract evenly spaced stills. Timestamps avoid the very first and last frame,
 * which are often black.
 */
export async function extractFrames(
  path: string,
  options: {
    count?: number;
    startSeconds?: number;
    endSeconds?: number;
    maxWidth?: number;
    outDir: string;
    durationSeconds?: number | null;
  },
): Promise<ExtractedFrame[]> {
  const count = clamp(Math.round(options.count ?? DEFAULT_FRAME_COUNT), 1, MAX_FRAME_COUNT);
  const duration =
    options.durationSeconds && options.durationSeconds > 0
      ? options.durationSeconds
      : (await probeVideo(path)).durationSeconds;
  const start = clamp(options.startSeconds ?? 0, 0, Math.max(0, (duration ?? 0) - 0.1));
  const end = clamp(options.endSeconds ?? duration ?? 0, start + 0.1, duration ?? start + 0.1);
  const span = Math.max(0.1, end - start);
  const maxWidth = clamp(Math.round(options.maxWidth ?? 1024), 320, 1600);

  await mkdir(options.outDir, { recursive: true });

  const frames: ExtractedFrame[] = [];
  for (let index = 0; index < count; index += 1) {
    const at = start + (span * (index + 0.5)) / count;
    const fileName = `frame-${String(index + 1).padStart(2, "0")}-${at.toFixed(1)}s.jpg`;
    const outPath = join(options.outDir, fileName);
    try {
      await execFileAsync(
        "ffmpeg",
        [
          "-v",
          "error",
          "-ss",
          at.toFixed(3),
          "-i",
          path,
          "-frames:v",
          "1",
          "-vf",
          `scale='min(${maxWidth},iw)':-2`,
          "-q:v",
          "3",
          "-y",
          outPath,
        ],
        { timeout: 120_000, maxBuffer: 8 * 1024 * 1024 },
      );
    } catch (error) {
      throw new Error(`ffmpeg kunne ikke hente bilde ved ${at.toFixed(1)}s: ${errorMessage(error)}`);
    }
    frames.push({ path: outPath, atSeconds: at, fileName });
  }
  return frames;
}

/**
 * Pull the audio track out as 16 kHz mono WAV (ready for speech-to-text).
 * Returns null for videos without an audio stream, which is common for screen
 * recordings.
 */
export async function extractAudioWav(path: string, outPath: string): Promise<string | null> {
  const info = await probeVideo(path);
  if (!info.audio) return null;
  await execFileAsync(
    "ffmpeg",
    ["-v", "error", "-i", path, "-vn", "-ac", "1", "-ar", "16000", "-y", outPath],
    { timeout: 300_000, maxBuffer: 8 * 1024 * 1024 },
  );
  return outPath;
}

export function visionEndpoint(): { baseUrl: string; apiKey: string; model: string } | null {
  const model =
    process.env.VIDEO_VISION_MODEL?.trim() ||
    process.env.OPENAI_COMPAT_MODEL?.trim() ||
    process.env.AGENT_MODEL?.trim() ||
    "";
  const baseUrl = (
    process.env.VIDEO_VISION_BASE_URL?.trim() ||
    process.env.OPENAI_COMPAT_BASE_URL?.trim() ||
    ""
  ).replace(/\/+$/, "");
  const apiKey =
    process.env.VIDEO_VISION_API_KEY?.trim() ||
    process.env.OPENAI_COMPAT_API_KEY?.trim() ||
    "";
  if (!model || !baseUrl) return null;
  return { baseUrl, apiKey, model };
}

function timestamp(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Ask the configured vision model to describe the sampled stills. Returns null
 * when no vision-capable endpoint is configured; the caller then just reports
 * metadata and the frame files.
 */
export async function describeFrames(
  frames: ExtractedFrame[],
  options: {
    question?: string;
    durationSeconds?: number | null;
    title?: string;
    /** "image" describes one still instead of a video. */
    mode?: "video" | "image";
  } = {},
): Promise<FrameDescription | null> {
  const endpoint = visionEndpoint();
  if (!endpoint || frames.length === 0) return null;

  const images = await Promise.all(
    frames.map(async (frame) => ({
      type: "image_url" as const,
      image_url: {
        url: `data:image/jpeg;base64,${(await readFile(frame.path)).toString("base64")}`,
      },
    })),
  );

  const question = options.question?.trim();
  const isImage = options.mode === "image";
  const prompt = isImage
    ? [
        `Dette er et bilde${options.title ? ` kalt "${options.title}"` : ""}.`,
        question
          ? `Svar på dette: ${question}`
          : "Beskriv bildet: hva som vises, handlinger, og lesbar tekst (ta med feilmeldinger ordrett). Svar på norsk, kort og konkret.",
      ].join("\n")
    : (() => {
        const duration = options.durationSeconds
          ? `Videoens lengde er ${timestamp(options.durationSeconds)}. `
          : "";
        const legend = frames
          .map((frame, index) => `Bilde ${index + 1}: ${timestamp(frame.atSeconds)}`)
          .join(", ");
        return [
          `${duration}Dette er ${frames.length} bilder hentet fra en video${options.title ? ` kalt "${options.title}"` : ""}.`,
          `Rekkefølge og tidspunkt — ${legend}.`,
          question
            ? `Svar på dette: ${question}`
            : "Beskriv hva som skjer i videoen: hva som vises, hvilke handlinger som utføres, tekst som er lesbar på skjermen, og hvordan innholdet endrer seg fra bilde til bilde. Svar på norsk, kort og konkret.",
        ].join("\n");
      })();

  const configuredMax = Number(process.env.VIDEO_VISION_MAX_TOKENS);
  // Groq's on-demand tier enforces a low output-tokens-per-minute limit, so the
  // default stays well below 1000 and a 429 shrinks it further.
  let maxTokens = Number.isFinite(configuredMax) && configuredMax > 0 ? configuredMax : 900;

  const requestBody = (limit: number) =>
    JSON.stringify({
      model: endpoint.model,
      messages: [
        {
          role: "user",
          content: [{ type: "text", text: prompt }, ...images],
        },
      ],
      max_tokens: limit,
      temperature: 0.2,
    });

  const send = async (limit: number) =>
    fetch(`${endpoint.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        ...(endpoint.apiKey ? { authorization: `Bearer ${endpoint.apiKey}` } : {}),
        "content-type": "application/json",
      },
      body: requestBody(limit),
      signal: AbortSignal.timeout(180_000),
    });

  let response: Response;
  try {
    response = await send(maxTokens);
    if (response.status === 429 && maxTokens > 400) {
      const detail = await response.clone().text().catch(() => "");
      if (/output tokens|OTPM|too large/i.test(detail)) {
        maxTokens = 400;
        response = await send(maxTokens);
      }
    }
  } catch (error) {
    throw new Error(`kunne ikke nå bildemodellen: ${errorMessage(error)}`);
  }

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`bildemodellen svarte ${response.status}: ${text.slice(0, 400)}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string | Array<{ type?: string; text?: string }> } }>;
  };
  const raw = data.choices?.[0]?.message?.content;
  const text =
    typeof raw === "string"
      ? raw
      : Array.isArray(raw)
        ? raw.map((part) => (typeof part.text === "string" ? part.text : "")).join("").trim()
        : "";
  if (!text) throw new Error("bildemodellen returnerte et tomt svar");
  return { text: text.trim(), model: endpoint.model };
}

/** Write frames to /workspace/videos/frames/<slug>/ inside the sandbox. */
export async function copyFramesToSandbox(
  session: Pick<SandboxSession, "run" | "writeBinaryFile">,
  slug: string,
  frames: ExtractedFrame[],
): Promise<string[]> {
  const dir = `/workspace/${SANDBOX_VIDEOS_DIR}/frames/${slug}`;
  await session.run({ command: `mkdir -p ${JSON.stringify(dir)}` });
  const written: string[] = [];
  for (const frame of frames) {
    const target = `${dir}/${frame.fileName}`;
    await session.writeBinaryFile({ path: target, content: new Uint8Array(await readFile(frame.path)) });
    written.push(target);
  }
  return written;
}

/** Read a video from /workspace into a host temp file for FFmpeg. */
export async function pullSandboxVideo(
  session: Pick<SandboxSession, "readBinaryFile">,
  sandboxPath: string,
  outDir: string,
): Promise<{ path: string; sizeBytes: number }> {
  const data = await session.readBinaryFile({ path: sandboxPath });
  if (!data) throw new Error(`fant ingen fil på ${sandboxPath}`);
  if (data.byteLength > MAX_SANDBOX_VIDEO_BYTES) {
    throw new Error(
      `videoen er ${(data.byteLength / 1024 / 1024).toFixed(0)} MB; grensen er ${
        MAX_SANDBOX_VIDEO_BYTES / 1024 / 1024
      } MB`,
    );
  }
  const path = join(outDir, `source${extname(sandboxPath) || ".mp4"}`);
  await writeFile(path, data);
  return { path, sizeBytes: data.byteLength };
}
