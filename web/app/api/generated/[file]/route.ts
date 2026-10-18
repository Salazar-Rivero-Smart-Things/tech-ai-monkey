import { NextResponse } from "next/server";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { extname, join, resolve } from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Next.js only serves files that existed in public/ at build time, so images
// the agent creates later are streamed through this route instead.

const CONTENT_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
};

function generatedDir(): string {
  const override = process.env.EVE_GENERATED_DIR?.trim();
  if (override) return resolve(override);
  return resolve(process.cwd(), "public", "generated");
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ file: string }> },
) {
  const { file } = await context.params;
  // Only a plain file name inside the generated folder.
  if (!/^[A-Za-z0-9._-]+$/.test(file) || file.includes("..")) {
    return NextResponse.json({ ok: false, error: "Invalid file name." }, { status: 400 });
  }

  const path = join(generatedDir(), file);
  if (!existsSync(path)) {
    return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  }

  const type = CONTENT_TYPES[extname(file).slice(1).toLowerCase()] ?? "application/octet-stream";
  return new NextResponse(new Uint8Array(await readFile(path)), {
    headers: {
      "content-type": type,
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
}
