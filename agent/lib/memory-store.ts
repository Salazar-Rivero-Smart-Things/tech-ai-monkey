import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

// Simple file-backed long-term memory, scoped per caller (principal).
// - Local dev: stores JSON files under .agent-memory/ in the project root.
// - Override the location with EVE_MEMORY_DIR if the process cwd differs.
// For a Vercel deployment, swap this for Vercel Blob or a database.
const MEMORY_DIR = process.env.EVE_MEMORY_DIR ?? join(process.cwd(), ".agent-memory");

export interface MemoryEntry {
  key: string;
  value: string;
  updatedAt: string;
}

function safeScope(userId: string): string {
  return userId.replace(/[^a-zA-Z0-9_.-]/g, "_") || "local";
}

async function readStore(userId: string): Promise<Record<string, MemoryEntry>> {
  try {
    const raw = await readFile(join(MEMORY_DIR, `${safeScope(userId)}.json`), "utf-8");
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, MemoryEntry>) : {};
  } catch {
    return {};
  }
}

async function writeStore(userId: string, store: Record<string, MemoryEntry>): Promise<void> {
  await mkdir(MEMORY_DIR, { recursive: true });
  await writeFile(join(MEMORY_DIR, `${safeScope(userId)}.json`), JSON.stringify(store, null, 2));
}

export async function listMemories(userId: string): Promise<MemoryEntry[]> {
  const store = await readStore(userId);
  return Object.values(store).sort((a, b) => a.key.localeCompare(b.key));
}

export async function putMemory(userId: string, key: string, value: string): Promise<MemoryEntry> {
  const store = await readStore(userId);
  const entry: MemoryEntry = { key, value, updatedAt: new Date().toISOString() };
  store[key] = entry;
  await writeStore(userId, store);
  return entry;
}

export async function removeMemory(userId: string, key: string): Promise<boolean> {
  const store = await readStore(userId);
  if (!(key in store)) return false;
  delete store[key];
  await writeStore(userId, store);
  return true;
}
