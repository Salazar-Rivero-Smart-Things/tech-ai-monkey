import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { DEFAULT_API_BASE } from "./version.js";

// Credentials live in a 0700 directory with a 0600 file:
//   Linux/macOS: ~/.config/tech-ai/credentials.json
//   Windows:     %USERPROFILE%\.config\tech-ai\credentials.json
export function configDir() {
  return process.env.TECH_AI_CONFIG_DIR || join(homedir(), ".config", "tech-ai");
}

export function configPath() {
  return join(configDir(), "credentials.json");
}

export function loadCredentials() {
  const file = configPath();
  if (!existsSync(file)) return null;
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8"));
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

export function saveCredentials(data) {
  const dir = configDir();
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const file = configPath();
  writeFileSync(file, JSON.stringify(data, null, 2) + "\n", { mode: 0o600 });
  try {
    chmodSync(file, 0o600);
    chmodSync(dir, 0o700);
  } catch {
    // Windows ignores POSIX modes — that is fine.
  }
  return file;
}

export function clearCredentials() {
  const file = configPath();
  if (existsSync(file)) {
    rmSync(file, { force: true });
    return true;
  }
  return false;
}

/** Precedence: --api flag > TECH_AI_API_URL > stored value > default. */
export function resolveApiBase(flagValue) {
  const stored = loadCredentials()?.apiBase;
  const value = flagValue || process.env.TECH_AI_API_URL || stored || DEFAULT_API_BASE;
  return String(value).replace(/\/+$/, "");
}

export function storedToken() {
  const creds = loadCredentials();
  return typeof creds?.token === "string" && creds.token ? creds.token : null;
}
