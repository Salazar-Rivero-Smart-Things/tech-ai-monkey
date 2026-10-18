import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

// ---------------------------------------------------------------------------
// Image generation.
//
// Two providers, chosen by environment:
//
//   1. Any OpenAI-compatible images API (recommended for production):
//        IMAGE_GEN_BASE_URL=https://api.openai.com/v1
//        IMAGE_GEN_API_KEY=sk-...
//        IMAGE_GEN_MODEL=gpt-image-1
//
//   2. Pollinations (free, no key) when no key is configured. Prompts are sent
//      to pollinations.ai, so use (1) if prompts may contain private data.
//
// Files are written into <repo>/web/public/generated/, which Next.js serves at
// /generated/<file>, so the chat can show the result inline.
// ---------------------------------------------------------------------------

const DEFAULT_BASE = "https://api.openai.com/v1";

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

/** Folder the generated images are written to (served as /generated/…). */
export function generatedDir(): string {
  const override = process.env.EVE_GENERATED_DIR?.trim();
  if (override) return resolve(override);
  const root = findRepoRoot(process.cwd()) ?? process.cwd();
  return join(root, "web", "public", "generated");
}

export interface ImageResult {
  file: string;
  /** Path the web app serves, e.g. "/generated/foo-123.jpg". */
  path: string;
  width: number;
  height: number;
  bytes: number;
  provider: string;
  /** Ready-to-use markdown the model can paste into the answer. */
  markdown: string;
}

function slugify(text: string): string {
  return (
    text
      .normalize("NFKD")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "bilde"
  );
}

function clampSize(value: number | undefined, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  const rounded = Math.round(n / 64) * 64;
  return Math.min(1536, Math.max(256, rounded));
}

interface ProviderConfig {
  kind: "openai" | "pollinations";
  baseUrl: string;
  apiKey: string;
  model: string;
}

export function imageProvider(): ProviderConfig {
  const apiKey = process.env.IMAGE_GEN_API_KEY?.trim() || "";
  const baseUrl = (process.env.IMAGE_GEN_BASE_URL?.trim() || DEFAULT_BASE).replace(/\/+$/, "");
  const model = process.env.IMAGE_GEN_MODEL?.trim() || "gpt-image-1";
  return apiKey
    ? { kind: "openai", baseUrl, apiKey, model }
    : { kind: "pollinations", baseUrl: "", apiKey: "", model: "" };
}

/**
 * Generate one image. Returns null when the provider answered but delivered no
 * image data, so the caller can report a clear error.
 */
export async function generateImage(options: {
  prompt: string;
  width?: number;
  height?: number;
  seed?: number;
}): Promise<ImageResult> {
  const prompt = options.prompt?.trim();
  if (!prompt) throw new Error("prompt er tomt");

  const width = clampSize(options.width, 1024);
  const height = clampSize(options.height, 1024);
  const provider = imageProvider();
  const started = Date.now();

  let bytes: Buffer;
  let extension: string;

  if (provider.kind === "pollinations") {
    const url = new URL(`https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}`);
    url.searchParams.set("width", String(width));
    url.searchParams.set("height", String(height));
    url.searchParams.set("nologo", "true");
    url.searchParams.set("seed", String(options.seed ?? Math.floor(Math.random() * 1_000_000)));
    const res = await fetch(url, { signal: AbortSignal.timeout(120_000) });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`bildetjenesten svarte ${res.status}: ${detail.slice(0, 200)}`);
    }
    const type = res.headers.get("content-type") ?? "";
    extension = type.includes("png") ? "png" : "jpg";
    bytes = Buffer.from(await res.arrayBuffer());
  } else {
    const res = await fetch(`${provider.baseUrl}/images/generations`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${provider.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: provider.model,
        prompt,
        n: 1,
        size: `${width}x${height}`,
        response_format: "b64_json",
      }),
      signal: AbortSignal.timeout(180_000),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`bildemodellen svarte ${res.status}: ${detail.slice(0, 300)}`);
    }
    const data = (await res.json()) as { data?: Array<{ b64_json?: string; url?: string }> };
    const first = data.data?.[0];
    if (!first) throw new Error("bildemodellen returnerte ingen bilder");
    if (first.b64_json) {
      bytes = Buffer.from(first.b64_json, "base64");
      extension = "png";
    } else if (first.url) {
      const download = await fetch(first.url, { signal: AbortSignal.timeout(120_000) });
      if (!download.ok) throw new Error(`kunne ikke hente bildet: ${download.status}`);
      extension = (download.headers.get("content-type") ?? "").includes("png") ? "png" : "jpg";
      bytes = Buffer.from(await download.arrayBuffer());
    } else {
      throw new Error("bildemodellen returnerte verken b64_json eller url");
    }
  }

  const dir = generatedDir();
  await mkdir(dir, { recursive: true });
  const file = `${slugify(prompt)}-${Date.now()}.${extension}`;
  await writeFile(join(dir, file), bytes);

  // Served by web/app/api/generated/[file] — Next.js does not pick up files
  // added to public/ after the build.
  const path = `/api/generated/${file}`;
  return {
    file,
    path,
    width,
    height,
    bytes: bytes.byteLength,
    provider: provider.kind === "pollinations" ? "pollinations (gratis)" : `${provider.model} (${provider.baseUrl})`,
    markdown: `![${prompt.replace(/[[\]]/g, "")}](${path})`,
  };
}

/** True when a paid, key-based provider is configured (prompts stay private). */
export function hasPrivateImageProvider(): boolean {
  return Boolean(process.env.IMAGE_GEN_API_KEY?.trim());
}

export function elapsedSeconds(startedAt: number): string {
  return ((Date.now() - startedAt) / 1000).toFixed(1);
}
