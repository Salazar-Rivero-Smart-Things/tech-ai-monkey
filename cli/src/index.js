#!/usr/bin/env node
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { ApiError, continueSession, createSession, streamReply, whoAmI } from "./api.js";
import {
  clearCredentials,
  configPath,
  loadCredentials,
  resolveApiBase,
  storedToken,
} from "./config.js";
import { loginWithBrowser, loginWithKey, loginWithPassword, persist } from "./login.js";
import { CLIENT_NAME, VERSION } from "./version.js";
import { bold, cyan, dim, fail, green, heading, red, say, warn, yellow } from "./ui.js";

function parseArgs(argv) {
  const flags = {};
  const positional = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--") {
      positional.push(...argv.slice(i + 1));
      break;
    }
    if (arg.startsWith("--")) {
      const [key, inline] = arg.slice(2).split("=");
      if (inline !== undefined) flags[key] = inline;
      else if (argv[i + 1] && !argv[i + 1].startsWith("-")) flags[key] = argv[(i += 1)];
      else flags[key] = true;
    } else if (arg === "-h") flags.help = true;
    else if (arg === "-v") flags.version = true;
    else positional.push(arg);
  }
  return { flags, positional };
}

const HELP = `${bold("tech-ai")} ${dim("v" + VERSION)} — command line for Tech AI monkey

${bold("USAGE")}
  tech-ai <command> [options]
  tech-ai                Sign in on the first run, then start the chat

${bold("COMMANDS")}
  login                  Sign in via your browser (Google or e-mail)
  login --key <key>      Sign in with an API key (Dashboard → API keys)
  login --email <e> --password <p>
                         Sign in with e-mail and password
  logout                 Remove the stored token from this machine
  whoami                 Show the signed-in account and remaining tokens
  ask <text>             Ask one question and print the answer
  chat                   Interactive chat (keeps the context between turns)
  version                Print the version
  help                   Show this help

${bold("OPTIONS")}
  --api <url>            API base URL (default: ${cyan("https://tech-ai.tech")})
  --session <id>         Continue an existing session with "ask"
  -h, --help             Show help
  -v, --version          Print the version

${bold("EXAMPLES")}
  tech-ai login
  tech-ai ask "why does my next build fail?"
  tech-ai chat

${bold("FILES")}
  ${dim(configPath())}
`;

/**
 * True only when a human can actually answer a question. Output is also
 * checked so that `tech-ai whoami | head` in a script never blocks.
 */
function canPrompt() {
  return (
    Boolean(stdin.isTTY && stdout.isTTY) &&
    process.env.TERM !== "dumb" &&
    !process.env.TECH_AI_NO_PROMPT
  );
}

/** One-shot readline question; always closes the interface afterwards. */
async function ask(question) {
  const rl = createInterface({ input: stdin, output: stdout });
  try {
    return (await rl.question(question)).trim().toLowerCase();
  } finally {
    rl.close();
  }
}

const YES = new Set(["y", "yes", "j", "ja", "ok"]);

function notSignedIn() {
  fail("You are not signed in. Run " + cyan("tech-ai login") + " first.");
  process.exit(1);
}

/**
 * Returns a usable token. When nobody is signed in we offer to start the
 * browser sign-in right here, so double-clicking the application-menu entry
 * (which runs "tech-ai chat") never dead-ends on a bare error message.
 */
async function requireAuth(apiBase) {
  const token = storedToken();
  if (token) return token;
  if (!canPrompt()) notSignedIn();

  const base = apiBase ?? resolveApiBase(undefined);

  say();
  say(bold("You are not signed in yet."));
  say(dim("Signing in opens your browser — Google or e-mail works."));
  say();

  const answer = await ask(cyan("Sign in now? ") + dim("[Y/n] "));
  if (answer && !YES.has(answer)) {
    say();
    notSignedIn();
  }

  try {
    const result = await loginWithBrowser(base);
    persist(base, result.token, result.user, result.unlimited);
    say();
    return result.token;
  } catch (error) {
    if (error instanceof ApiError) handleApiError(error);
    fail(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

function handleApiError(error) {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      fail("The session token is no longer valid. Run " + cyan("tech-ai login") + " again.");
    } else if (error.status === 402) {
      fail("You are out of tokens. Upgrade your plan or add prepaid tokens.");
    } else if (error.status === 429) {
      fail("Too many attempts — wait a few minutes and try again.");
    } else {
      fail(error.message);
    }
    process.exit(error.status === 402 ? 2 : 1);
  }
  fail(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

/** Stream one turn and print it, returning { sessionId, continuationToken, startIndex }. */
async function runTurn(apiBase, token, { sessionId, continuationToken, startIndex = 0, message }) {
  let nextContinuation = continuationToken ?? null;
  let createdSession = sessionId;
  let nextStartIndex = Number(startIndex ?? 0);

  if (!createdSession) {
    const created = await createSession(apiBase, token, message);
    createdSession = created?.sessionId ?? null;
    if (!createdSession) throw new Error("The server did not create a session.");
    nextContinuation = created.continuationToken ?? nextContinuation;
    nextStartIndex = 0;
  } else {
    const continued = await continueSession(
      apiBase,
      token,
      createdSession,
      message,
      nextContinuation,
    );
    nextContinuation = continued?.continuationToken ?? nextContinuation;
  }

  let streamed = "";
  let final = "";

  const streamStats = await streamReply(apiBase, token, createdSession, {
    startIndex: nextStartIndex,
    onDelta: (text) => {
      streamed += text;
      stdout.write(text);
    },
    onMessage: (text) => {
      final = text;
    },
    onNotice: (text) => {
      warn(text);
    },
    onError: (text) => {
      if (!streamed) fail(text);
      else say("\n" + red(text));
    },
    onWaiting: (continuation) => {
      nextContinuation = continuation;
    },
  });

  nextStartIndex += Number(streamStats?.eventCount ?? 0);

  if (final && !streamed) {
    stdout.write(final);
  } else if (final && final.startsWith(streamed) && final.length > streamed.length) {
    stdout.write(final.slice(streamed.length));
  }
  stdout.write("\n");

  return {
    sessionId: createdSession,
    continuationToken: nextContinuation,
    startIndex: nextStartIndex,
  };
}

async function commandLogin(flags, positional) {
  const apiBase = resolveApiBase(flags.api);

  if (flags.key) {
    try {
      const result = await loginWithKey(apiBase, flags.key);
      persist(apiBase, result.token, result.user, result.unlimited);
      return 0;
    } catch (error) {
      handleApiError(error);
    }
  }

  const email = flags.email ?? positional[0];
  const password = flags.password ?? (email ? positional[1] : undefined);
  if (email && password) {
    try {
      const result = await loginWithPassword(apiBase, { email, password });
      persist(apiBase, result.token, result.user, result.unlimited);
      return 0;
    } catch (error) {
      handleApiError(error);
    }
  }

  if (email && !password) {
    fail("Missing password. Use " + cyan("--password <pass>") + " (or omit --email for browser login).");
    return 1;
  }

  try {
    const result = await loginWithBrowser(apiBase);
    persist(apiBase, result.token, result.user, result.unlimited);
    return 0;
  } catch (error) {
    if (error instanceof ApiError) handleApiError(error);
    fail(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

async function commandWhoami(flags) {
  const apiBase = resolveApiBase(flags.api);
  const token = await requireAuth(apiBase);

  let me;
  try {
    me = await whoAmI(apiBase, token);
  } catch (error) {
    handleApiError(error);
  }

  heading("Account");
  say(`  ${dim("e-mail   ")} ${me.user?.email ?? "—"}`);
  say(`  ${dim("name     ")} ${me.user?.name ?? "—"}`);
  say(`  ${dim("role     ")} ${me.user?.role ?? "—"}`);
  say(`  ${dim("API      ")} ${apiBase}`);

  if (me.unlimited) {
    say(`  ${dim("plan     ")} ${green("Unlimited — owner account, never metered")}`);
  } else {
    const remaining = Number(me.tokensRemaining ?? 0);
    const colour = remaining <= 0 ? red : remaining < 10_000 ? yellow : green;
    say(`  ${dim("plan     ")} ${me.planName ?? me.plan}`);
    say(`  ${dim("tokens   ")} ${colour(String(remaining))} remaining`);
    if (me.prepaidTokens) say(`  ${dim("prepaid  ")} ${me.prepaidTokens}`);
  }
  say("");
  return 0;
}

async function commandAsk(flags, positional) {
  const apiBase = resolveApiBase(flags.api);
  const token = await requireAuth(apiBase);
  const message = positional.join(" ").trim();
  if (!message) {
    fail("Nothing to ask. Example: " + cyan('tech-ai ask "how do I X?"'));
    return 1;
  }

  try {
    const result = await runTurn(apiBase, token, {
      sessionId: typeof flags.session === "string" ? flags.session : null,
      message,
    });
    if (typeof flags.session !== "string") {
      say(dim(`session ${result.sessionId} — continue with: tech-ai ask --session ${result.sessionId} "…"`));
    }
    return 0;
  } catch (error) {
    handleApiError(error);
  }
}

async function commandChat(flags) {
  const apiBase = resolveApiBase(flags.api);
  const token = await requireAuth(apiBase);

  const credentials = loadCredentials();
  say();
  say(bold(`${CLIENT_NAME} v${VERSION}`));
  say(dim(`  signed in as ${credentials?.user?.email ?? "unknown"} · ${apiBase}`));
  if (credentials?.unlimited) say(dim("  unlimited (owner account)"));
  say(dim("  type /exit to quit, /new for a fresh conversation"));

  const rl = createInterface({ input: stdin, output: stdout });
  let sessionId = null;
  let continuationToken = null;
  let startIndex = 0;

  try {
    while (true) {
      const input = (await rl.question(cyan("\nyou › "))).trim();
      if (!input) continue;
      if (input === "/exit" || input === "/quit") break;
      if (input === "/new") {
        sessionId = null;
        continuationToken = null;
        startIndex = 0;
        say(dim("  started a new conversation"));
        continue;
      }

      stdout.write(dim("\nai  › "));
      try {
        const result = await runTurn(apiBase, token, {
          sessionId,
          continuationToken,
          startIndex,
          message: input,
        });
        sessionId = result.sessionId;
        continuationToken = result.continuationToken;
        startIndex = result.startIndex ?? startIndex;
      } catch (error) {
        if (error instanceof ApiError) {
          fail(error.message);
          if (error.status === 401 || error.status === 402) break;
        } else {
          fail(error instanceof Error ? error.message : String(error));
        }
      }
    }
  } finally {
    rl.close();
  }
  return 0;
}

/**
 * No arguments: what the application-menu entry and a double-clicked .exe run.
 * Signs the user in on the first run, then drops straight into the chat.
 */
async function commandWelcome(flags) {
  const apiBase = resolveApiBase(flags.api);
  if (!storedToken()) await requireAuth(apiBase);
  return commandChat(flags);
}

async function main() {
  const argv = process.argv.slice(2);
  const { flags, positional } = parseArgs(argv);
  const command = positional.shift() ?? (canPrompt() ? "welcome" : "help");

  if (flags.version || command === "version") {
    say(`${CLIENT_NAME} ${VERSION}`);
    return 0;
  }
  if (flags.help || command === "help" || command === "--help") {
    say(HELP);
    return 0;
  }

  switch (command) {
    case "login":
    case "signin":
      return commandLogin(flags, positional);

    case "logout":
    case "signout": {
      const removed = clearCredentials();
      say(removed ? green("✓") + " Signed out on this machine." : dim("Nothing to sign out."));
      return 0;
    }

    case "whoami":
    case "status":
      return commandWhoami(flags);

    case "ask":
      return commandAsk(flags, positional);

    case "chat":
      return commandChat(flags);

    case "welcome":
    case "start":
      return commandWelcome(flags);

    default:
      fail(`Unknown command: ${command}`);
      say(dim("Run " + cyan("tech-ai help") + " to see the available commands."));
      return 1;
  }
}

main()
  .then((code) => process.exit(code ?? 0))
  .catch((error) => {
    fail(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
