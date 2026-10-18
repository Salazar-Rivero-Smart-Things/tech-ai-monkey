import { NextResponse } from "next/server";
import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { resolveApiCaller } from "@/lib/api-caller";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Images and videos the chat accepts. Everything else is rejected.
const IMAGE_EXTS = ["png", "jpg", "jpeg", "webp", "gif"];
const VIDEO_EXTS = [
  "mp4",
  "m4v",
  "mov",
  "avi",
  "mkv",
  "webm",
  "wmv",
  "mpg",
  "mpeg",
  "3gp",
  "ogv",
  "ts",
  "mts",
  "m2ts",
];

const DOC_EXTS = ["txt", "md", "markdown", "rtf", "doc", "docx", "pdf"];

const MAX_BYTES = 200 * 1024 * 1024;

/** Walk up from cwd looking for the repo root (has agent/ and web/). */
function repoRoot(): string {
  let dir = resolve(process.cwd());
  for (let i = 0; i < 5; i += 1) {
    if (existsSync(join(dir, "agent")) && existsSync(join(dir, "web"))) return dir;
    const parent = resolve(dir, "..");
    if (parent === dir) break;
    dir = parent;
  }
  return resolve(process.cwd(), "..");
}

function uploadsDir(): string {
  return process.env.EVE_UPLOADS_DIR?.trim() || join(repoRoot(), "uploads");
}

function safeName(name: string): string {
  const base = name.replace(/\\/g, "/").split("/").pop() ?? "fil";
  return (
    base
      .normalize("NFKD")
      .replace(/[^\w.\-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 120) || "fil"
  );
}

export async function POST(request: Request) {
  const caller = await resolveApiCaller(request);
  if (!caller) {
    return NextResponse.json({ ok: false, error: "Not authenticated." }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "Expected multipart form data." }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "No file in the request." }, { status: 400 });
  }

  const originalName = safeName(file.name || "fil");
  const ext = extname(originalName).slice(1).toLowerCase();
  const isImage = IMAGE_EXTS.includes(ext);
  const isVideo = VIDEO_EXTS.includes(ext);
  const isDocument = DOC_EXTS.includes(ext);
  if (!isImage && !isVideo && !isDocument) {
    return NextResponse.json(
      {
        ok: false,
        error: `Unsupported file type ".${ext}". Images: ${IMAGE_EXTS.join(", ")}. Videos: ${VIDEO_EXTS.join(", ")}. Documents: ${DOC_EXTS.join(", ")}.`,
      },
      { status: 415 },
    );
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { ok: false, error: `The file is larger than ${MAX_BYTES / 1024 / 1024} MB.` },
      { status: 413 },
    );
  }

  const storedAs = `${Date.now()}-${originalName}`;
  const dir = uploadsDir();
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, storedAs), Buffer.from(await file.arrayBuffer()));

  return NextResponse.json({
    ok: true,
    file: {
      storedAs,
      originalName,
      kind: isImage ? "image" : isVideo ? "video" : "document",
      sizeBytes: file.size,
    },
  });
}
