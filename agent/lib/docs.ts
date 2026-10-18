import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, join, resolve } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

// ---------------------------------------------------------------------------
// Reading uploaded documents (txt, md, rtf, docx, doc, pdf).
//
// Everything happens on the host, because the sandbox has no converters:
//   txt/md   read as UTF-8
//   rtf      strip control words
//   docx     unzip word/document.xml and strip tags (no external tool needed)
//   doc      LibreOffice headless (falls back to strings extraction)
//   pdf      pdftotext if present
// ---------------------------------------------------------------------------

export const DOCUMENT_FORMATS = ["txt", "md", "markdown", "text", "rtf", "doc", "docx", "pdf"] as const;

/** Above this the extracted text is truncated before it enters the model. */
const MAX_TEXT_CHARS = 60_000;

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

export function uploadsDir(): string {
  const override = process.env.EVE_UPLOADS_DIR?.trim();
  if (override) return resolve(override);
  const root = findRepoRoot(process.cwd()) ?? process.cwd();
  return join(root, "uploads");
}

export interface UploadedDocument {
  file: string;
  originalName: string;
  format: string;
  path: string;
  sizeBytes: number;
}

export async function findDocument(query: string): Promise<UploadedDocument | null> {
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
    if (!(lower === base || lower.includes(base) || lower.replace(/^\d+-/, "") === base)) continue;
    const format = extname(file).slice(1).toLowerCase();
    if (!(DOCUMENT_FORMATS as readonly string[]).includes(format)) continue;
    const path = join(uploadsDir(), file);
    try {
      const info = await stat(path);
      if (!info.isFile()) continue;
      return {
        file,
        originalName: file.replace(/^\d+-/, ""),
        format,
        path,
        sizeBytes: info.size,
      };
    } catch {
      // ignore unreadable entries
    }
  }
  return null;
}

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)));
}

/** docx: pull the paragraph text out of word/document.xml. */
async function docxToText(path: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "eve-docx-"));
  try {
    await execFileAsync("unzip", ["-o", "-q", path, "word/document.xml", "-d", dir], {
      timeout: 60_000,
      maxBuffer: 32 * 1024 * 1024,
    });
    const xml = await readFile(join(dir, "word", "document.xml"), "utf8");
    return decodeXmlEntities(
      xml
        .replace(/<w:tab\/>/g, "\t")
        .replace(/<w:br\/>/g, "\n")
        .replace(/<\/w:p>/g, "\n")
        .replace(/<[^>]+>/g, "")
        .replace(/\n{3,}/g, "\n\n")
        .trim(),
    );
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

/** rtf: drop control words, keep readable text. */
function rtfToText(raw: string): string {
  return raw
    .replace(/\\'([0-9a-f]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\\u(-?\d+)\??/g, (_, code) => String.fromCharCode(((Number(code) % 65536) + 65536) % 65536))
    .replace(/\\par[d]?/g, "\n")
    .replace(/\\tab/g, "\t")
    .replace(/\{\\\*[^{}]*\}/g, "")
    .replace(/\\[a-z]+-?\d* ?/gi, "")
    .replace(/[{}]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function hasBinary(binary: string): Promise<boolean> {
  try {
    await execFileAsync("sh", ["-c", `command -v ${binary}`], { timeout: 5_000 });
    return true;
  } catch {
    return false;
  }
}

/** doc (legacy Word): LibreOffice headless, else printable strings. */
async function docToText(path: string): Promise<string> {
  if (await hasBinary("libreoffice")) {
    const dir = await mkdtemp(join(tmpdir(), "eve-doc-"));
    try {
      await execFileAsync(
        "libreoffice",
        ["--headless", "--convert-to", "txt:Text", "--outdir", dir, path],
        { timeout: 180_000, maxBuffer: 32 * 1024 * 1024 },
      );
      const produced = (await readdir(dir)).find((name) => name.endsWith(".txt"));
      if (produced) return (await readFile(join(dir, produced), "utf8")).trim();
    } catch {
      // fall through to strings
    } finally {
      await rm(dir, { recursive: true, force: true }).catch(() => {});
    }
  }
  const buffer = await readFile(path);
  const printable = buffer
    .toString("latin1")
    .replace(/[^\x09\x0a\x0d\x20-\x7e\u00a0-\u00ff]+/g, " ")
    .replace(/[ ]{2,}/g, " ")
    .trim();
  return printable;
}

async function pdfToText(path: string): Promise<string> {
  if (await hasBinary("pdftotext")) {
    const dir = await mkdtemp(join(tmpdir(), "eve-pdf-"));
    try {
      const out = join(dir, "out.txt");
      await execFileAsync("pdftotext", ["-layout", path, out], {
        timeout: 120_000,
        maxBuffer: 32 * 1024 * 1024,
      });
      return (await readFile(out, "utf8")).trim();
    } finally {
      await rm(dir, { recursive: true, force: true }).catch(() => {});
    }
  }
  throw new Error(
    "PDF krever pdftotext på serveren (sudo apt install poppler-utils). DOCX, RTF, TXT og DOC fungerer uten.",
  );
}

export interface ExtractedDocument {
  file: string;
  format: string;
  chars: number;
  truncated: boolean;
  text: string;
  note: string;
}

export async function extractDocument(doc: UploadedDocument): Promise<ExtractedDocument> {
  let text: string;
  let note = "";

  switch (doc.format) {
    case "txt":
    case "text":
    case "md":
    case "markdown":
      text = (await readFile(doc.path, "utf8")).trim();
      break;
    case "rtf":
      text = rtfToText(await readFile(doc.path, "utf8"));
      note = "RTF-kontrollkoder er strippet.";
      break;
    case "docx":
      text = await docxToText(doc.path);
      note = "Tekst hentet fra word/document.xml.";
      break;
    case "doc":
      text = await docToText(doc.path);
      note = "Konvertert fra gammelt Word-format; formatering er borte.";
      break;
    case "pdf":
      text = await pdfToText(doc.path);
      note = "Tekst hentet med pdftotext (bilder/skanninger blir ikke lest).";
      break;
    default:
      throw new Error(`Formatet ".${doc.format}" støttes ikke.`);
  }

  const normalized = text.replace(/\r\n/g, "\n").replace(/[ \t]+\n/g, "\n").trim();
  const truncated = normalized.length > MAX_TEXT_CHARS;
  return {
    file: doc.originalName,
    format: doc.format,
    chars: normalized.length,
    truncated,
    text: truncated ? normalized.slice(0, MAX_TEXT_CHARS) : normalized,
    note,
  };
}

/** Keep the extracted text on disk so the agent can grep it instead of re-pasting. */
export async function saveExtractedText(name: string, text: string): Promise<string> {
  const dir = join(uploadsDir(), "tekst");
  await import("node:fs/promises").then(({ mkdir }) => mkdir(dir, { recursive: true }));
  const file = `${name.replace(/\.[^.]+$/, "").replace(/[^A-Za-z0-9._-]+/g, "-")}.txt`;
  await writeFile(join(dir, file), text, "utf8");
  return `uploads/tekst/${file}`;
}
