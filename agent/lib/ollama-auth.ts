import { spawn } from "node:child_process";
import { createHmac, randomBytes } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

// ---------------------------------------------------------------------------
// Kontinuerlig nøkkelrotasjon, prompt-komprimering og selvhelbredelse for
// lokal Ollama-motor (tech-ai.tech monkey v2.0.1).
//
// Sørger for:
//   1. Kontinuerlig rotasjon av en signert lokal API-nøkkel hvert 10. minutt
//      og automatisk gjenoppretting ved 401/403/404 eller nettverksfeil.
//   2. Komprimering av systemprompt og verktøyliste før kall til lokal Ollama,
//      slik at prompten krymper fra ~8700 tokens til ~250-900 tokens og modellen
//      svarer på 1–3 sekunder i stedet for å bruke minutter på CPU/GPU.
// ---------------------------------------------------------------------------

const DEFAULT_OLLAMA_BASE_URL = "http://127.0.0.1:11434/v1";
const DEFAULT_OLLAMA_MODEL = "tech-ai-monkey";
const FALLBACK_OLLAMA_MODEL = "llama3.2:3b";
const DEFAULT_CONTEXT_TOKENS = 4_096;
const KEY_ROTATION_INTERVAL_MS =
  Number(process.env.OLLAMA_KEY_ROTATION_MS ?? 10 * 60_000) || 10 * 60_000;

const COMPACT_SYSTEM_PROMPT = [
  "Du er tech-ai.tech monkey v2.0.1, en rask, selvforbedrende og 100 % selvstendig AI-agent som kjører på egen lokal Ollama-motor.",
  "Svar alltid på brukerens språk (norsk når brukeren skriver norsk) kort, presist og direkte. Gjenta aldri hilsener.",
  "Du kan lage komplette PHP-webfiler (.php med <?php ... ?> + HTML/CSS/SQL), HTML/CSS/JS og applikasjoner.",
  "VIKTIG NÅR BRUKEREN VIL BYGGE ELLER LAGE NOE (f.eks. PHP-fil eller nettside): Ikke still oppfølgingsspørsmål! Lever hele den ferdige, kjørbare koden med en gang i en ```php eller ```html kodeblokk (hold koden kompakt på 30–55 linjer så hele filen fullføres).",
  "PHP-REGEL: I .php-filer skal PHP-behandlingen ligge øverst og lukkes med ?> FØR <!DOCTYPE html>, slik: <?php $melding = ''; if (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST') { $navn = trim($_POST['navn'] ?? ''); $epost = trim($_POST['epost'] ?? ''); $melding = 'Takk, ' . $navn; } ?> <!DOCTYPE html><html>...<?php if ($melding): ?><p><?= htmlspecialchars($melding) ?></p><?php endif; ?>...</html>. Bruk kun innebygd standard-PHP ($_POST, filter_var, date), aldri udefinerte klasser eller HTML inne i echo \"...\".",
  "Viktige sider ved spørsmål: API-nøkler: https://tech-ai.tech/dashboard/api-keys | VS Code: https://tech-ai.tech/docs/vscode | Last ned Ollama & CLI: https://tech-ai.tech/download | Dashboard: https://tech-ai.tech/dashboard | Personvern: https://tech-ai.tech/privacy.",
].join(" ");

type KeyManagerState = {
  currentKey: string;
  rotatedAt: number;
  rotationCount: number;
  envMtimeMs: number;
  envCustomKey: string | null;
  fallbackModelId: string | null;
};

const globalState = globalThis as typeof globalThis & {
  __techAiOllamaKeyState?: KeyManagerState;
};

function findRepoRoot(): string {
  const cwd = resolve(process.cwd());
  return existsSync(join(cwd, "agent")) ? cwd : resolve(cwd, "..");
}

/** Laster .env på nytt fra disk hvis filen er endret siden sist. */
function reloadEnvIfNeeded(): void {
  const state = ensureState();
  const envPath = join(findRepoRoot(), ".env");
  try {
    const info = statSync(envPath);
    if (info.mtimeMs <= state.envMtimeMs) return;
    state.envMtimeMs = info.mtimeMs;
    const raw = readFileSync(envPath, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (
        key.startsWith("OLLAMA_") ||
        key.startsWith("OPENAI_COMPAT_") ||
        key.startsWith("VIDEO_VISION_")
      ) {
        process.env[key] = val;
      }
    }
    const configured =
      process.env.OLLAMA_API_KEY?.trim() ||
      process.env.OPENAI_COMPAT_API_KEY?.trim() ||
      "";
    if (configured && configured !== "ollama" && configured !== "auto-rotate") {
      state.envCustomKey = configured;
    } else {
      state.envCustomKey = null;
    }
  } catch {
    // Ignorer hvis .env ikke kan leses akkurat nå.
  }
}

function generateSignedLocalKey(): string {
  const secret =
    process.env.AGENT_API_KEY_SECRET?.trim() ||
    "tech-ai-monkey-local-ollama-secret";
  const ts = Math.floor(Date.now() / 1000);
  const nonce = randomBytes(6).toString("hex");
  const sig = createHmac("sha256", secret)
    .update(`ollama:${ts}:${nonce}`)
    .digest("hex")
    .slice(0, 24);
  return `sk-ollama-live-${ts}-${nonce}-${sig}`;
}

function ensureState(): KeyManagerState {
  if (!globalState.__techAiOllamaKeyState) {
    globalState.__techAiOllamaKeyState = {
      currentKey: generateSignedLocalKey(),
      rotatedAt: Date.now(),
      rotationCount: 1,
      envMtimeMs: 0,
      envCustomKey: null,
      fallbackModelId: null,
    };
  }
  return globalState.__techAiOllamaKeyState;
}

/** Roterer API-nøkkelen umiddelbart og lagrer status i .eve/ollama-key-state.json. */
export async function rotateOllamaApiKey(reason = "scheduled"): Promise<string> {
  const state = ensureState();
  reloadEnvIfNeeded();

  const nextKey = state.envCustomKey || generateSignedLocalKey();
  state.currentKey = nextKey;
  state.rotatedAt = Date.now();
  state.rotationCount += 1;

  process.env.OLLAMA_API_KEY = nextKey;
  process.env.OPENAI_COMPAT_API_KEY = nextKey;

  const statePath = join(findRepoRoot(), ".eve", "ollama-key-state.json");
  try {
    await mkdir(dirname(statePath), { recursive: true });
    await writeFile(
      statePath,
      JSON.stringify(
        {
          rotatedAt: new Date(state.rotatedAt).toISOString(),
          rotationCount: state.rotationCount,
          reason,
          keyPrefix: `${nextKey.slice(0, 18)}...`,
          baseUrl: getOllamaBaseUrl(),
          model: getOllamaModelId(),
        },
        null,
        2,
      ),
      "utf8",
    );
  } catch {
    // Ikke la skrivefeil stoppe modellkallet.
  }

  return nextKey;
}

/** Returnerer alltid en fersk og gyldig API-nøkkel (roterer automatisk ved utløp). */
export function getActiveOllamaApiKey(): string {
  const state = ensureState();
  reloadEnvIfNeeded();
  if (Date.now() - state.rotatedAt >= KEY_ROTATION_INTERVAL_MS) {
    void rotateOllamaApiKey("interval-expired");
  }
  return state.envCustomKey || state.currentKey;
}

export function getOllamaBaseUrl(): string {
  reloadEnvIfNeeded();
  const raw =
    process.env.OLLAMA_BASE_URL?.trim() ||
    process.env.OPENAI_COMPAT_BASE_URL?.trim() ||
    DEFAULT_OLLAMA_BASE_URL;
  return raw.replace(/\/+$/, "");
}

export function getOllamaRootUrl(): string {
  return getOllamaBaseUrl().replace(/\/v1$/, "");
}

export function getOllamaModelId(): string {
  const state = ensureState();
  reloadEnvIfNeeded();
  if (state.fallbackModelId) return state.fallbackModelId;
  return (
    process.env.OLLAMA_MODEL?.trim() ||
    process.env.OPENAI_COMPAT_MODEL?.trim() ||
    process.env.AGENT_MODEL?.trim() ||
    DEFAULT_OLLAMA_MODEL
  );
}

export function getOllamaContextTokens(): number {
  reloadEnvIfNeeded();
  const n = Number(
    process.env.OLLAMA_CONTEXT_TOKENS ??
      process.env.OPENAI_COMPAT_CONTEXT_TOKENS ??
      DEFAULT_CONTEXT_TOKENS,
  );
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_CONTEXT_TOKENS;
}

/** Sjekker at lokal Ollama kjører og returnerer installerte modeller. */
export async function probeOllamaModels(): Promise<string[]> {
  const rootUrl = getOllamaRootUrl();
  try {
    const res = await fetch(`${rootUrl}/api/tags`, {
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { models?: Array<{ name?: string }> };
    return (data.models ?? [])
      .map((m) => m.name?.trim() ?? "")
      .filter(Boolean);
  } catch {
    return [];
  }
}

/** Starter lokal `ollama serve` i bakgrunnen dersom tjenesten har stoppet. */
export async function ensureOllamaReady(): Promise<{
  healthy: boolean;
  models: string[];
  activeModel: string;
}> {
  let models = await probeOllamaModels();
  if (models.length === 0) {
    try {
      const child = spawn("ollama", ["serve"], {
        detached: true,
        stdio: "ignore",
      });
      child.unref();
      await new Promise((r) => setTimeout(r, 2_000));
      models = await probeOllamaModels();
    } catch {
      // Ignorer hvis ollama-binæren styres av systemd og allerede starter.
    }
  }

  const state = ensureState();
  const configured =
    process.env.OLLAMA_MODEL?.trim() ||
    process.env.OPENAI_COMPAT_MODEL?.trim() ||
    DEFAULT_OLLAMA_MODEL;

  if (models.length > 0) {
    const matchesConfigured = models.some(
      (m) => m === configured || m === `${configured}:latest`,
    );
    if (matchesConfigured) {
      state.fallbackModelId = null;
    } else {
      const preferred =
        models.find((m) => m === FALLBACK_OLLAMA_MODEL) ??
        models.find((m) => m.startsWith("llama3.2")) ??
        models.find((m) => m.startsWith("llama3")) ??
        models[0];
      if (preferred) {
        state.fallbackModelId = preferred;
      }
    }
  }

  return {
    healthy: models.length > 0,
    models,
    activeModel: getOllamaModelId(),
  };
}

/**
 * Kalles fra supervisor hvert minutt:
 *  - Roterer API-nøkkelen før den rekker å gå ut på tid
 *  - Verifiserer at lokal Ollama er oppe og modellen er klar
 */
export async function maintainOllamaKeyAndHealth(): Promise<{
  text: string;
  changed: boolean;
}> {
  const state = ensureState();
  let rotated = false;
  if (Date.now() - state.rotatedAt >= KEY_ROTATION_INTERVAL_MS) {
    await rotateOllamaApiKey("supervisor-tick");
    rotated = true;
  }
  const status = await ensureOllamaReady();
  const ageMin = Math.round((Date.now() - state.rotatedAt) / 60_000);
  return {
    text: status.healthy
      ? `ollama ok (${status.activeModel}, nøkkel #${state.rotationCount}, ${ageMin}m gammel)`
      : `ollama utilgjengelig (forsøkte gjenstart)`,
    changed: rotated || !status.healthy,
  };
}

function extractLastUserText(messages: Array<Record<string, unknown>>): string {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const msg = messages[i];
    if (msg?.role !== "user") continue;
    const c = msg.content;
    if (typeof c === "string") return c;
    if (Array.isArray(c)) {
      return c
        .map((part) =>
          part && typeof part === "object" && typeof (part as { text?: unknown }).text === "string"
            ? (part as { text: string }).text
            : "",
        )
        .join(" ");
    }
  }
  return "";
}

/**
 * Velger kun de verktøyene som faktisk trengs for meldingen, og kutter ned
 * tunge systemprompter fra ~8700 tokens til ~250 tokens slik at lokal Ollama
 * svarer på 1–3 sekunder.
 */
function selectNeededToolNames(userText: string): Set<string> | null {
  const lower = userText.toLowerCase();
  const needed = new Set<string>();

  if (/\[vedlagt:|analyze_image|skjermbilde|screenshot|\.(png|jpg|jpeg|webp|gif)\b/.test(lower)) {
    needed.add("analyze_image");
  }
  if (/\[vedlagt:.*?\.(mp4|mov|avi|mkv|webm)|analyze_video|list_videos|se på video|videoen/.test(lower)) {
    needed.add("list_videos");
    needed.add("analyze_video");
  }
  if (/\[vedlagt:.*?\.(pdf|docx?|txt|md|rtf)|analyze_document/.test(lower)) {
    needed.add("analyze_document");
  }
  if (/\b(tegn|generer et bilde|lag et bilde|draw|generate an image|illustration|logo idea)\b/.test(lower)) {
    needed.add("generate_image");
  }
  if (/\b(husk at|remember that|lagre i minne|hva husker du|list_memories|glem at|forget)\b/.test(lower)) {
    needed.add("remember");
    needed.add("list_memories");
    needed.add("forget");
  }
  if (/\b(lær denne|learn this|learn_skill|list_skills|forget_skill)\b/.test(lower)) {
    needed.add("learn_skill");
    needed.add("list_skills");
    needed.add("forget_skill");
  }
  if (/\b(slett historikk|tøm chat|delete history|clear history|reset chat)\b/.test(lower)) {
    needed.add("delete_chat_history");
  }
  if (/\b(list_books|import_book|hvilke bøker|les boken)\b/.test(lower)) {
    needed.add("list_books");
    needed.add("import_book");
  }
  if (/\b(issue_api_key|utsted en intern nøkkel)\b/.test(lower)) {
    needed.add("issue_api_key");
  }
  if (/\b(søk på nett|search the web|nyheter|siste nytt|hva er prisen i dag|web_search)\b/.test(lower)) {
    needed.add("web_search");
    needed.add("web_fetch");
  }
  if (/\b(\/workspace|save_artifact|pakke prosjektet|last ned prosjekt|kjør i sandkasse|run in sandbox)\b/.test(lower)) {
    needed.add("bash");
    needed.add("write_file");
    needed.add("read_file");
    needed.add("save_artifact");
  }

  return needed.size > 0 ? needed : null;
}

/** Komprimerer JSON-body for rask lokal Ollama-inferens. */
function optimizeBodyForLocalOllama(
  body: BodyInit | null | undefined,
  targetModel: string,
): BodyInit | null | undefined {
  if (typeof body !== "string") return body;
  try {
    const parsed = JSON.parse(body) as Record<string, unknown>;
    parsed.model = targetModel;
    parsed.keep_alive = "24h";

    if (Array.isArray(parsed.messages)) {
      let msgs = parsed.messages as Array<Record<string, unknown>>;
      // Erstatt det tunge (~2500 tokens) rammeverk-systempromptet med en kompakt versjon
      for (const msg of msgs) {
        if (msg && msg.role === "system" && typeof msg.content === "string" && msg.content.length > 300) {
          msg.content = COMPACT_SYSTEM_PROMPT;
        }
      }

      // Hold kontekstvinduet slankt ved lange samtaler (systemmelding + siste 8 meldinger)
      if (msgs.length > 9) {
        const sysMsgs = msgs.filter((m) => m?.role === "system").slice(0, 1);
        const recentMsgs = msgs.filter((m) => m?.role !== "system").slice(-8);
        msgs = [...sysMsgs, ...recentMsgs];
        parsed.messages = msgs;
      }

      const lastMsg = msgs[msgs.length - 1];
      const isAfterToolResult = lastMsg?.role === "tool";
      const userText = extractLastUserText(msgs);
      const neededTools = selectNeededToolNames(userText);

      if (isAfterToolResult || !neededTools) {
        // Vanlig samtale eller ferdig verktøykall: fjern 25 tunge verktøyskjemaer (~6200 tokens)
        delete parsed.tools;
        delete parsed.tool_choice;
      } else if (Array.isArray(parsed.tools)) {
        const filtered = (parsed.tools as Array<Record<string, unknown>>)
          .filter((t) => {
            const fn = t?.function as { name?: string } | undefined;
            return fn?.name ? neededTools.has(fn.name) : false;
          })
          .map((t) => {
            const fn = { ...((t.function as Record<string, unknown>) ?? {}) };
            if (typeof fn.description === "string" && fn.description.length > 100) {
              fn.description = fn.description.slice(0, 100);
            }
            return { ...t, function: fn };
          });
        if (filtered.length > 0) {
          parsed.tools = filtered;
        } else {
          delete parsed.tools;
          delete parsed.tool_choice;
        }
      }
    }

    return JSON.stringify(parsed);
  } catch {
    return body;
  }
}

/**
 * Wrapper rundt fetch som:
 *  1. Alltid setter fersk Authorization-header fra kontinuerlig nøkkelrotasjon
 *  2. Komprimerer prompt og verktøyskjemaer så lokal Ollama svarer på få sekunder
 *  3. Ved 401/403/404 eller tilkoblingsfeil roterer nøkkel / sjekker Ollama og
 *     prøver kallet på nytt automatisk
 *  4. Holder en tidsfrist over hele svaret inkludert streaming
 */
export function createSelfHealingModelFetch(timeoutMs: number): typeof fetch {
  return async (input, init) => {
    const executeAttempt = async (attempt: number): Promise<Response> => {
      const controller = new AbortController();
      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, timeoutMs);

      const signal = init?.signal
        ? AbortSignal.any([init.signal, controller.signal])
        : controller.signal;

      const headers = new Headers(init?.headers);
      headers.set("Authorization", `Bearer ${getActiveOllamaApiKey()}`);

      const activeModel = getOllamaModelId();
      const body = optimizeBodyForLocalOllama(init?.body, activeModel);

      let res: Response;
      try {
        res = await fetch(input, {
          ...init,
          headers,
          body,
          signal,
        });
      } catch (error) {
        clearTimeout(timer);
        if (timedOut) {
          throw new Error(`modellen svarte ikke innen ${Math.round(timeoutMs / 1000)} s`);
        }
        if (attempt === 0) {
          await rotateOllamaApiKey("connection-retry");
          await ensureOllamaReady();
          return executeAttempt(1);
        }
        throw error;
      }

      if ((res.status === 401 || res.status === 403 || res.status === 404) && attempt === 0) {
        clearTimeout(timer);
        await rotateOllamaApiKey(`http-${res.status}-auto-heal`);
        await ensureOllamaReady();
        return executeAttempt(1);
      }

      if (!res.body) {
        clearTimeout(timer);
        return res;
      }

      const reader = res.body.getReader();
      const wrapped = new ReadableStream<Uint8Array>({
        async pull(streamController) {
          try {
            const { done, value } = await reader.read();
            if (done) {
              clearTimeout(timer);
              streamController.close();
            } else {
              streamController.enqueue(value);
            }
          } catch (error) {
            clearTimeout(timer);
            if (timedOut) {
              streamController.error(
                new Error(`modellen sluttet å svare etter ${Math.round(timeoutMs / 1000)} s`),
              );
            } else {
              streamController.error(error);
            }
          }
        },
        cancel(reason) {
          clearTimeout(timer);
          return reader.cancel(reason);
        },
      });

      return new Response(wrapped, {
        status: res.status,
        statusText: res.statusText,
        headers: res.headers,
      });
    };

    return executeAttempt(0);
  };
}
