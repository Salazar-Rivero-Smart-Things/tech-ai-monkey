import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile, readdir, stat } from "node:fs/promises";
import { dirname, extname, join, resolve } from "node:path";
import { promisify } from "node:util";
import { slugify } from "./skills-store";

// ---------------------------------------------------------------------------
// Host-side book library.
//
// The agent reads files from inside its sandbox, which shares no filesystem
// with the host, and the book formats people actually have (PDF, EPUB) are
// binaries the sandbox image has no tools to read. So the conversion happens
// here, on the host, and only plain text is copied across:
//
//   <repo>/books/atomic-habits.pdf   (the owner drops the file here)
//        │  import_book: pdftotext / unzip + tag strip
//        ▼
//   /workspace/books/atomic-habits.txt   (read_file, grep and bash can use it)
//
// The folder is git-ignored: books are usually copyrighted and must not be
// committed. Override the location with EVE_BOOKS_DIR.
// ---------------------------------------------------------------------------

const execFileAsync = promisify(execFile);

/** Cap for the conversion commands: books are large but not gigabytes. */
const MAX_COMMAND_BYTES = 256 * 1024 * 1024;

/** Where converted books land inside the sandbox, relative to /workspace. */
export const SANDBOX_BOOKS_DIR = "books";

/** File extensions the library accepts, without the dot. */
export const BOOK_FORMATS = ["txt", "md", "markdown", "text", "pdf", "epub"] as const;

export interface HostBook {
  /** File-safe id, also the name the sandbox copy gets. */
  slug: string;
  /** Title derived from the file name. */
  title: string;
  /** Original file name, e.g. "atomic-habits.pdf". */
  file: string;
  /** Lower-case extension without the dot. */
  format: string;
  /** Absolute path on the host. */
  path: string;
  sizeBytes: number;
}

export interface ExtractedBook {
  text: string;
  /** How the text was produced, surfaced to the model for transparency. */
  notes: string[];
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

/** The folder the owner drops books into. */
export function booksDir(): string {
  const override = process.env.EVE_BOOKS_DIR?.trim();
  if (override) return resolve(override);
  const root = findRepoRoot(process.cwd()) ?? process.cwd();
  return join(root, "books");
}

/** Path the book gets inside the sandbox, relative to /workspace. */
export function sandboxBookPath(book: HostBook): string {
  return `${SANDBOX_BOOKS_DIR}/${book.slug}.txt`;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function titleFromFile(file: string): string {
  const base = file.replace(/\.[^.]+$/, "");
  return base.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim() || base;
}

export async function listHostBooks(): Promise<HostBook[]> {
  const dir = booksDir();
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return [];
  }

  const books: HostBook[] = [];
  for (const file of entries) {
    const format = extname(file).slice(1).toLowerCase();
    if (!(BOOK_FORMATS as readonly string[]).includes(format)) continue;
    const path = join(dir, file);
    try {
      const info = await stat(path);
      if (!info.isFile()) continue;
      books.push({
        slug: slugify(titleFromFile(file)),
        title: titleFromFile(file),
        file,
        format,
        path,
        sizeBytes: info.size,
      });
    } catch {
      // Unreadable entry: skip it instead of failing the whole listing.
    }
  }
  return books.sort((a, b) => a.title.localeCompare(b.title));
}

/** Resolve a loose name ("Atomic Habits", "atomic-habits.pdf") to one book. */
export async function findHostBook(query: string): Promise<HostBook | null> {
  const needle = query.trim().toLowerCase();
  if (!needle) return null;
  const books = await listHostBooks();
  return (
    books.find((book) => book.file.toLowerCase() === needle) ??
    books.find((book) => book.slug === needle) ??
    books.find((book) => book.title.toLowerCase() === needle) ??
    books.find((book) => book.file.toLowerCase().includes(needle)) ??
    books.find((book) => book.title.toLowerCase().includes(needle)) ??
    null
  );
}

export async function extractBookText(book: HostBook): Promise<ExtractedBook> {
  switch (book.format) {
    case "txt":
    case "md":
    case "markdown":
    case "text":
      return { text: await readFile(book.path, "utf-8"), notes: ["read as plain text"] };
    case "pdf":
      return { text: await pdfToText(book.path), notes: ["converted with pdftotext -layout"] };
    case "epub":
      return { text: await epubToText(book.path), notes: ["converted from the EPUB spine"] };
    default:
      throw new Error(
        `Unsupported format ".${book.format}". Use ${BOOK_FORMATS.map((f) => `.${f}`).join(", ")}.`,
      );
  }
}

async function pdfToText(path: string): Promise<string> {
  try {
    const { stdout } = await execFileAsync(
      "pdftotext",
      ["-layout", "-enc", "UTF-8", path, "-"],
      { maxBuffer: MAX_COMMAND_BYTES },
    );
    return stdout;
  } catch (error) {
    throw new Error(
      `Could not convert the PDF with pdftotext (${errorMessage(error)}). ` +
        "Install poppler-utils on the server, or drop a .txt version of the book in the library.",
    );
  }
}

async function epubToText(path: string): Promise<string> {
  await assertNotDrm(path);
  const entries = await epubReadingOrder(path);
  const parts: string[] = [];
  for (const entry of entries) {
    const html = await readEntry(path, entry);
    if (html === null) continue;
    const text = htmlToText(html);
    if (text) parts.push(text);
  }
  if (parts.length === 0) {
    throw new Error(
      `No readable text found in the EPUB (${entries.length} chapter files were listed).`,
    );
  }
  return parts.join("\n\n");
}

/**
 * Font obfuscation is normal in DRM-free EPUBs, so only an encrypted content
 * document counts as DRM: the text itself would come out as noise.
 */
async function assertNotDrm(path: string): Promise<void> {
  const [rights, encryption] = await Promise.all([
    readEntry(path, "META-INF/rights.xml"),
    readEntry(path, "META-INF/encryption.xml"),
  ]);
  if (rights === null && encryption === null) return;

  const encrypted = encryption
    ? [...encryption.matchAll(/CipherReference[^>]*\bURI\s*=\s*"([^"]*)"/gi)]
        .map((match) => archivePath("", match[1] ?? ""))
        .filter((entry) => /\.(x?html?|opf|ncx)$/i.test(entry))
    : [];
  if (rights !== null || encrypted.length > 0) {
    throw new Error(
      "This EPUB is DRM-protected, so its text cannot be read. A book bought with DRM " +
        "(Adobe, Kindle) has to be converted to a DRM-free EPUB first.",
    );
  }
}

/**
 * Chapter files in reading order. EPUB stores the order in the OPF spine, so
 * read that first and only fall back to sorted file names if it is unusable.
 */
async function epubReadingOrder(path: string): Promise<string[]> {
  const container = await readEntry(path, "META-INF/container.xml");
  const opfPath = container
    ? attr(container.match(/<rootfile\b[^>]*>/i)?.[0] ?? "", "full-path")
    : null;
  if (!opfPath) return htmlEntries(path);

  const normalizedOpf = archivePath("", opfPath);
  const opf = await readEntry(path, normalizedOpf);
  if (opf === null) return htmlEntries(path);

  const base = dirname(normalizedOpf);
  const hrefById = new Map<string, string>();
  for (const tag of opf.match(/<item\b[^>]*>/gi) ?? []) {
    const id = attr(tag, "id");
    const href = attr(tag, "href");
    if (id && href) hrefById.set(id, href);
  }

  const ordered: string[] = [];
  for (const tag of opf.match(/<itemref\b[^>]*>/gi) ?? []) {
    const idref = attr(tag, "idref");
    const href = idref ? hrefById.get(idref) : undefined;
    if (href) ordered.push(archivePath(base, href));
  }
  return ordered.length > 0 ? ordered : htmlEntries(path);
}

/** Fallback order: every HTML entry, sorted "part2" before "part10". */
async function htmlEntries(path: string): Promise<string[]> {
  try {
    const { stdout } = await execFileAsync("unzip", ["-Z1", path], {
      maxBuffer: MAX_COMMAND_BYTES,
    });
    return stdout
      .split("\n")
      .map((line) => line.trim())
      .filter((entry) => /\.x?html?$/i.test(entry))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  } catch (error) {
    throw new Error(
      `Could not read the EPUB with unzip (${errorMessage(error)}). Make sure unzip is ` +
        "installed on the server and that the file is a valid, DRM-free EPUB.",
    );
  }
}

/** One entry from the archive, or null when the archive has no such entry. */
async function readEntry(file: string, entry: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync("unzip", ["-p", file, entry], {
      maxBuffer: MAX_COMMAND_BYTES,
    });
    return stdout;
  } catch {
    return null;
  }
}

function attr(tag: string, name: string): string | null {
  return new RegExp(`${name}\\s*=\\s*"([^"]*)"`, "i").exec(tag)?.[1] ?? null;
}

/**
 * Resolve an href against the folder of the OPF that declared it. Hrefs are
 * URL-encoded, may carry a `#fragment`, and may climb upwards with `..`.
 */
function archivePath(base: string, href: string): string {
  const target = href.split("#")[0];
  const raw = base && base !== "." ? `${base}/${target}` : target;
  const parts: string[] = [];
  for (const segment of raw.split("/")) {
    const decoded = decodeSegment(segment);
    if (!decoded || decoded === ".") continue;
    if (decoded === "..") parts.pop();
    else parts.push(decoded);
  }
  return parts.join("/");
}

/** Decode per segment, so an encoded slash can never split a path. */
function decodeSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

// Latin-1 named entities, generated from the standard name/code order so the
// whole range is covered without a 200-line table.
const LATIN1_NAMES =
  "Agrave Aacute Acirc Atilde Auml Aring AElig Ccedil Egrave Eacute Ecirc Euml Igrave Iacute " +
  "Icirc Iuml ETH Ntilde Ograve Oacute Ocirc Otilde Ouml Oslash Ugrave Uacute Ucirc Uuml " +
  "Yacute THORN szlig agrave aacute acirc atilde auml aring aelig ccedil egrave eacute ecirc " +
  "euml igrave iacute icirc iuml eth ntilde ograve oacute ocirc otilde ouml oslash ugrave " +
  "uacute ucirc uuml yacute thorn yuml";
const LATIN1_CHARS =
  "ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿ";

const EXTRA_ENTITIES: Record<string, string> = {
  nbsp: " ",
  quot: '"',
  amp: "&",
  lt: "<",
  gt: ">",
  apos: "'",
  copy: "©",
  reg: "®",
  trade: "™",
  euro: "€",
  pound: "£",
  yen: "¥",
  cent: "¢",
  deg: "°",
  plusmn: "±",
  times: "×",
  divide: "÷",
  micro: "µ",
  para: "¶",
  sect: "§",
  middot: "·",
  bull: "•",
  dagger: "†",
  Dagger: "‡",
  laquo: "«",
  raquo: "»",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
  sbquo: "‚",
  bdquo: "„",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  permil: "‰",
  frac12: "½",
  frac14: "¼",
  frac34: "¾",
  sup1: "¹",
  sup2: "²",
  sup3: "³",
  ordf: "ª",
  ordm: "º",
  iexcl: "¡",
  iquest: "¿",
  brvbar: "¦",
  uml: "¨",
  macr: "¯",
  acute: "´",
  cedil: "¸",
  oelig: "œ",
  OElig: "Œ",
  scaron: "š",
  Scaron: "Š",
  shy: "",
  ensp: " ",
  emsp: " ",
  thinsp: " ",
};

const NAMED_ENTITIES: Record<string, string> = (() => {
  const names = LATIN1_NAMES.split(" ");
  const chars = [...LATIN1_CHARS];
  const table: Record<string, string> = { ...EXTRA_ENTITIES };
  names.forEach((name, index) => {
    const char = chars[index];
    if (name && char) table[name] = char;
  });
  return table;
})();

function codePointFrom(value: number): string {
  const usable = value > 0 && value <= 0x10ffff && (value < 0xd800 || value > 0xdfff);
  return usable ? String.fromCodePoint(value) : "";
}

function decodeEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, digits: string) => codePointFrom(Number(digits)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => codePointFrom(parseInt(hex, 16)))
    .replace(/&([a-z][a-z0-9]{1,31});/g, (match, name: string) => NAMED_ENTITIES[name] ?? match);
}

/** Turn one HTML chapter into readable text, keeping paragraph breaks. */
function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<head\b[^>]*>[\s\S]*?<\/head>/gi, "")
      .replace(/<(script|style|nav)\b[^>]*>[\s\S]*?<\/\1>/gi, "")
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/<img\b[^>]*>/gi, (tag) => {
        const alt = attr(tag, "alt");
        return alt ? ` [Illustration: ${alt}] ` : " ";
      })
      .replace(/<\s*br\s*\/?>/gi, "\n")
      .replace(/<\s*hr\s*\/?>/gi, "\n\n")
      .replace(/<\s*\/\s*(td|th)\s*>/gi, " | ")
      .replace(/<\s*\/\s*(p|div|h[1-6]|li|tr|section|article|blockquote|figcaption)\s*>/gi, "\n\n")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t\u00a0]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}
