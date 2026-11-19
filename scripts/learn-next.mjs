#!/usr/bin/env node
/**
 * Tech AI Monkey — Start learning the next software engineering / tech topic.
 *
 * Usage:
 *   npm run learn:next
 *   npm run learn:next -- "TypeScript 5.8 new features and strict patterns"
 *   node scripts/learn-next.mjs --list
 */

import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { SignJWT } from "jose";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const SKILLS_DIR = join(ROOT, "skills");
const NOTES_DIR = join(SKILLS_DIR, "study-notes");
const LOG_PATH = join(SKILLS_DIR, "study-log.json");

const DEFAULT_CURRICULUM = [
  "Latest TypeScript & Node.js runtime features, performance improvements, and best practices",
  "Modern Next.js App Router, React 19 Server Actions, caching, and streaming architectures",
  "PostgreSQL indexing, query optimization, JSONB patterns, and Drizzle ORM best practices",
  "Local LLM engineering: llama.cpp quantization (GGUF Q4_K_M/Q6_K), Vulkan/CUDA tuning, and context management",
  "AI agent tool-calling reliability, MCP servers, structured JSON outputs, and evaluation harnesses",
  "Web security essentials: OWASP Top 10, JWT/OAuth2/PKCE hardening, CSRF/XSS prevention, and rate limiting",
  "Python 3.13+ async patterns, FastAPI production architecture, Pydantic v2, and testing",
  "DevOps & Linux reliability: systemd services, Caddy reverse proxy, backups, observability, and Docker",
  "Tech magazine radar: Hacker News, InfoQ, Ars Technica, and GitHub Trending software engineering highlights",
  "Rust & systems tooling for web developers (esbuild, Biome, SWC, Tauri, and WebAssembly)",
];

function loadEnv(filePath) {
  const out = {};
  if (!existsSync(filePath)) return out;
  const raw = readFileSyncCompat(filePath);
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    const v = t.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    out[k] = v;
  }
  return out;
}

import { readFileSync as readFileSyncCompat } from "node:fs";

function slugify(s) {
  return (
    s
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "topic"
  );
}

async function readLog() {
  try {
    const raw = await readFile(LOG_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return {
      nextIndex: Number(parsed.nextIndex) || 0,
      curriculum: Array.isArray(parsed.curriculum) && parsed.curriculum.length
        ? parsed.curriculum
        : DEFAULT_CURRICULUM,
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
    };
  } catch {
    return {
      nextIndex: 0,
      curriculum: DEFAULT_CURRICULUM,
      sessions: [],
    };
  }
}

async function saveLog(data) {
  await mkdir(SKILLS_DIR, { recursive: true });
  await writeFile(LOG_PATH, JSON.stringify(data, null, 2) + "\n", "utf8");
}

async function signToken(secret) {
  return new SignJWT({ scope: "agent", role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer("my-ai-agent")
    .setAudience("my-ai-agent-api")
    .setSubject("study-runner")
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(new TextEncoder().encode(secret));
}

async function askAgent(agentUrl, token, prompt) {
  const headers = { "content-type": "application/json" };
  if (token) headers.authorization = `Bearer ${token}`;

  const createRes = await fetch(`${agentUrl}/eve/v1/session`, {
    method: "POST",
    headers,
    body: JSON.stringify({ message: prompt }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!createRes.ok) {
    throw new Error(`Agent session error (${createRes.status}): ${await createRes.text()}`);
  }
  const { sessionId } = await createRes.json();
  if (!sessionId) throw new Error("No sessionId returned by agent.");

  const streamRes = await fetch(`${agentUrl}/eve/v1/session/${encodeURIComponent(sessionId)}/stream`, {
    headers: token ? { authorization: `Bearer ${token}` } : {},
    signal: AbortSignal.timeout(180_000),
  });
  if (!streamRes.ok || !streamRes.body) {
    throw new Error(`Agent stream error (${streamRes.status})`);
  }

  const reader = streamRes.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  let done = false;

  while (!done) {
    const { done: eof, value } = await reader.read();
    if (eof) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      let ev;
      try {
        ev = JSON.parse(line);
      } catch {
        continue;
      }
      if (ev.type === "message.appended" && ev.data?.messageDelta) {
        text += ev.data.messageDelta;
        process.stdout.write(ev.data.messageDelta);
      } else if (ev.type === "message.completed" && typeof ev.data?.message === "string" && ev.data.message) {
        if (!text) process.stdout.write(ev.data.message);
        text = ev.data.message;
      } else if (ev.type === "turn.failed" || ev.type === "session.failed") {
        throw new Error(ev.data?.message || "Agent turn failed.");
      } else if (ev.type === "session.waiting" || ev.type === "session.completed") {
        done = true;
        break;
      }
    }
  }
  process.stdout.write("\n");
  return { sessionId, text: text.trim() };
}

async function main() {
  const args = process.argv.slice(2);
  const log = await readLog();

  if (args.includes("--list")) {
    console.log("=== Tech AI Monkey — Study Curriculum ===");
    log.curriculum.forEach((topic, i) => {
      const marker = i === log.nextIndex % log.curriculum.length ? " -> [NEXT]" : "";
      console.log(`  ${i + 1}. ${topic}${marker}`);
    });
    console.log(`\nCompleted sessions logged: ${log.sessions.length}`);
    return;
  }

  const customTopic = args.filter((a) => !a.startsWith("--")).join(" ").trim();
  const idx = log.nextIndex % log.curriculum.length;
  const topic = customTopic || log.curriculum[idx];

  const env = { ...loadEnv(join(ROOT, ".env")), ...process.env };
  const agentUrl = (env.EVE_PUBLIC_URL || "http://127.0.0.1:2000").replace(/\/+$/, "");
  const secret = env.AGENT_API_KEY_SECRET || "";

  console.log("==========================================================");
  console.log("  TECH AI MONKEY — LEARNING NEXT TOPIC");
  console.log("  Supervisors: Gemini & DeepSeek");
  console.log("==========================================================");
  console.log(`Topic : ${topic}`);
  console.log(`Mode  : ${customTopic ? "Custom topic" : `Curriculum #${idx + 1}/${log.curriculum.length}`}`);
  console.log(`Agent : ${agentUrl}`);
  console.log("----------------------------------------------------------\n");

  const prompt = [
    `Study session (supervised by Gemini & DeepSeek) — Topic: "${topic}".`,
    "Follow the Daily Tech & Software Engineering Learning skill:",
    "1. Summarize the 3–5 most important practical takeaways for a software engineer.",
    "2. Include at least one concrete code/config pattern or pitfall to avoid.",
    "3. Use web search to verify latest versions/news and include sources.",
    "4. Keep the brief crisp and structured in markdown so it can be archived as a study note.",
  ].join("\n");

  const startedAt = Date.now();
  const engineUsed = "eve-agent";
  const token = secret ? await signToken(secret) : "";
  let result;
  try {
    result = await askAgent(agentUrl, token, prompt);
  } catch (agentErr) {
    console.error(`\n[ERROR] Could not reach Tech AI Monkey Agent on ${agentUrl}.`);
    console.error(`        Details: ${agentErr.message}`);
    console.error("        Start Tech AI Monkey first (start-tech-ai-monkey.bat) or set EVE_PUBLIC_URL.");
    process.exit(1);
  }

  const durationSec = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
  const nowIso = new Date().toISOString();
  const datePrefix = nowIso.slice(0, 10);
  const noteFilename = `${datePrefix}-${slugify(topic)}.md`;
  const notePath = join(NOTES_DIR, noteFilename);

  await mkdir(NOTES_DIR, { recursive: true });
  const noteContent = [
    "---",
    `topic: ${topic}`,
    `studiedAt: ${nowIso}`,
    `durationSeconds: ${durationSec}`,
    `engine: ${engineUsed}`,
    `supervisors: Gemini, DeepSeek`,
    "---",
    "",
    `# ${topic}`,
    "",
    result.text || "(No output generated)",
    "",
  ].join("\n");
  await writeFile(notePath, noteContent, "utf8");

  const summary = (result.text || "")
    .replace(/[#*_`>-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 220);

  log.sessions.unshift({
    id: `${Date.now()}`,
    topic,
    studiedAt: nowIso,
    durationSeconds: durationSec,
    engine: engineUsed,
    sessionId: result.sessionId,
    noteFile: `skills/study-notes/${noteFilename}`,
    summary,
  });
  log.sessions = log.sessions.slice(0, 200);
  if (!customTopic) {
    log.nextIndex = (idx + 1) % log.curriculum.length;
  }
  await saveLog(log);

  console.log("\n----------------------------------------------------------");
  console.log(`Saved study note : skills/study-notes/${noteFilename}`);
  console.log(`Study duration   : ${durationSec}s (${engineUsed})`);
  console.log(`Next queued topic: ${log.curriculum[log.nextIndex % log.curriculum.length]}`);
  console.log("==========================================================");
}

main().catch((err) => {
  console.error("Failed to run learn-next:", err.message || err);
  process.exit(1);
});
