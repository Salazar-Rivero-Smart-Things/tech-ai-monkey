// Thin HTTP client for the Tech AI monkey API. Uses the global `fetch`
// (Node 18+), so the CLI has zero runtime dependencies.

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function describe(res) {
  try {
    const body = await res.json();
    if (body && (body.error || body.code)) return String(body.error ?? body.code);
  } catch {
    // not JSON
  }
  return `${res.status} ${res.statusText}`;
}

async function request(url, { method = "GET", token, body, signal } = {}) {
  const headers = {};
  if (body !== undefined) headers["content-type"] = "application/json";
  if (token) headers.authorization = `Bearer ${token}`;
  if (!token) headers["user-agent"] = "tech-ai-cli";

  let res;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (cause) {
    const reason = cause instanceof Error ? cause.message : String(cause);
    throw new ApiError(`Could not reach ${url} (${reason})`, 0);
  }
  if (!res.ok) throw new ApiError(await describe(res), res.status);
  return res;
}

async function json(url, options) {
  return (await request(url, options)).json();
}

// --- identity ---------------------------------------------------------------

export function whoAmI(apiBase, token) {
  return json(`${apiBase}/api/cli/me`, { token });
}

export function passwordGrant(apiBase, { email, password, name }) {
  return json(`${apiBase}/api/cli/token`, {
    method: "POST",
    body: { grant_type: "password", email, password, name },
  });
}

export function exchangeCode(apiBase, { code, codeVerifier, name }) {
  return json(`${apiBase}/api/cli/token`, {
    method: "POST",
    body: { grant_type: "authorization_code", code, code_verifier: codeVerifier, name },
  });
}

// --- eve agent --------------------------------------------------------------

export async function createSession(apiBase, token, message) {
  return json(`${apiBase}/eve/v1/session`, {
    method: "POST",
    token,
    body: { message },
  });
}

export async function continueSession(apiBase, token, sessionId, message, continuationToken) {
  const body = { message };
  if (continuationToken) body.continuationToken = continuationToken;
  return json(`${apiBase}/eve/v1/session/${encodeURIComponent(sessionId)}`, {
    method: "POST",
    token,
    body,
  });
}

/**
 * Stream a turn. Calls:
 *   onDelta(text)      incremental assistant text
 *   onMessage(text)    the final assistant message for the turn
 *   onNotice(text)     non-fatal notice (e.g. billing warning)
 *   onWaiting(token)   the agent is waiting; a continuation token was issued
 *   onError(text)      the turn failed
 * Resolves when the turn ends.
 */
export async function streamReply(apiBase, token, sessionId, handlers = {}) {
  const res = await request(
    `${apiBase}/eve/v1/session/${encodeURIComponent(sessionId)}/stream`,
    { token },
  );
  if (!res.body) return;

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let settled = false;

  const finish = (event) => {
    if (settled) return;
    settled = true;
    handlers.onDone?.(event);
  };

  while (!settled) {
    const { done, value } = await reader.read();
    if (done) {
      finish("stream-end");
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.trim()) continue;
      let event;
      try {
        event = JSON.parse(line);
      } catch {
        continue;
      }
      const data = event?.data ?? {};
      switch (event?.type) {
        case "message.appended":
          if (data.messageDelta) handlers.onDelta?.(String(data.messageDelta));
          break;
        case "message.completed":
          if (data.message) handlers.onMessage?.(String(data.message));
          break;
        case "session.waiting":
          if (data.continuationToken) handlers.onWaiting?.(String(data.continuationToken));
          finish("waiting");
          break;
        case "turn.failed":
          handlers.onError?.(String(data.message ?? "The turn failed."));
          finish("failed");
          break;
        case "billing.error":
          handlers.onNotice?.(String(data.message ?? "Billing problem."));
          break;
        case "turn.completed":
        case "session.completed":
          finish("completed");
          break;
        default:
          break;
      }
    }
  }

  try {
    await reader.cancel();
  } catch {
    // already closed
  }
}
