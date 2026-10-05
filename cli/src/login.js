import { createHash, randomBytes } from "node:crypto";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { exchangeCode, passwordGrant, whoAmI } from "./api.js";
import { saveCredentials } from "./config.js";
import { CLIENT_NAME } from "./version.js";
import { cyan, dim, fail, green, say, warn } from "./ui.js";

const LOGIN_TIMEOUT_MS = 5 * 60 * 1000;

function makePkce() {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier, "utf8").digest("base64url");
  return { verifier, challenge };
}

function openBrowser(url) {
  const attempts =
    process.platform === "darwin"
      ? [["open", [url]]]
      : process.platform === "win32"
        ? [["cmd", ["/c", "start", "", url]]]
        : [
            ["xdg-open", [url]],
            ["gio", ["open", url]],
            ["sensible-browser", [url]],
          ];

  for (const [command, args] of attempts) {
    try {
      const child = spawn(command, args, { stdio: "ignore", detached: true });
      child.on("error", () => {});
      child.unref();
      return true;
    } catch {
      // try the next opener
    }
  }
  return false;
}

const SUCCESS_HTML = `<!doctype html><html><head><meta charset="utf-8">
<title>Tech AI monkey</title>
<style>
 body{font-family:system-ui,sans-serif;background:#09090b;color:#f4f4f5;
      display:flex;align-items:center;justify-content:center;height:100vh;margin:0}
 div{text-align:center;max-width:32rem;padding:2rem}
 h1{font-size:1.25rem;margin:0 0 .75rem}
 p{color:#a1a1aa;font-size:.9rem;line-height:1.6;margin:0}
 code{background:#18181b;padding:.15rem .4rem;border-radius:.25rem}
</style></head><body><div>
<h1>&#10003; You are signed in</h1>
<p>You can close this tab and return to the terminal.<br>
Trouble? Run <code>tech-ai login</code> again.</p>
</div></body></html>`;

/** Browser login: Google or e-mail on the web page, loopback callback to us. */
export async function loginWithBrowser(apiBase) {
  const { verifier, challenge } = makePkce();
  const state = randomBytes(16).toString("base64url");

  const codePromise = new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      let url;
      try {
        url = new URL(req.url ?? "/", "http://127.0.0.1");
      } catch {
        res.writeHead(400).end("bad request");
        return;
      }
      if (url.pathname !== "/callback") {
        res.writeHead(404, { "content-type": "text/plain" }).end("not found");
        return;
      }

      const code = url.searchParams.get("code");
      const returnedState = url.searchParams.get("state");
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end(SUCCESS_HTML);

      if (returnedState !== state) {
        reject(new Error("Login state did not match — aborting."));
      } else if (!code) {
        reject(new Error("The login callback did not include a code."));
      } else {
        resolve(code);
      }

      setTimeout(() => server.close(), 250);
    });

    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      if (!port) {
        reject(new Error("Could not open a local callback port."));
        return;
      }

      const authUrl = new URL(`${apiBase}/cli-login`);
      authUrl.searchParams.set("port", String(port));
      authUrl.searchParams.set("state", state);
      authUrl.searchParams.set("challenge", challenge);
      authUrl.searchParams.set("name", CLIENT_NAME);

      say();
      say(`Opening your browser to sign in to ${cyan(apiBase)} …`);
      if (!openBrowser(authUrl.toString())) {
        warn("Could not open a browser automatically.");
      }
      say(dim("If nothing opens, paste this URL:"));
      say("  " + cyan(authUrl.toString()));
      say();
    });

    setTimeout(() => reject(new Error("Login timed out after 5 minutes.")), LOGIN_TIMEOUT_MS);
  });

  const code = await codePromise;
  const result = await exchangeCode(apiBase, { code, codeVerifier: verifier, name: CLIENT_NAME });
  if (!result?.token) throw new Error("The server did not return a token.");
  return result;
}

/** Paste an API key created in Dashboard → API keys. */
export async function loginWithKey(apiBase, key) {
  const trimmed = String(key ?? "").trim();
  if (!trimmed) throw new Error("Empty API key.");
  const me = await whoAmI(apiBase, trimmed);
  return { token: trimmed, user: me.user, unlimited: me.unlimited };
}

/** E-mail + password. */
export async function loginWithPassword(apiBase, { email, password }) {
  const result = await passwordGrant(apiBase, { email, password, name: CLIENT_NAME });
  if (!result?.token) throw new Error("The server did not return a token.");
  return result;
}

export function persist(apiBase, token, user, unlimited) {
  const file = saveCredentials({
    apiBase,
    token,
    user: user ?? null,
    unlimited: Boolean(unlimited),
    savedAt: new Date().toISOString(),
  });
  say(green("✓") + " Signed in as " + cyan(user?.email ?? "unknown"));
  say(dim("  Token saved to " + file));
  if (unlimited) say(dim("  Plan: Unlimited (owner account)"));
}

export function reportLoginFailure(error) {
  fail(error instanceof Error ? error.message : String(error));
}
