import http from "node:http";

const PORT = Number(process.env.PORT || 8080);
const LLAMA_URL = process.env.LLAMA_INTERNAL_URL || "http://127.0.0.1:18080";
const MODEL_NAME = process.env.LOCAL_AI_MODEL || "qwen2.5-coder-7b-instruct-q4_k_m.gguf";
const MCP_API_KEY = (process.env.MCP_API_KEY || "").trim();

const TOOLS = [
  {
    name: "qwen_ask",
    description:
      "Ask Qwen2.5-Coder-7B (hosted privately on Railway) any programming, architecture, debugging, SQL, DevOps, or technical question.",
    inputSchema: {
      type: "object",
      properties: {
        prompt: { type: "string", description: "The question or task for Qwen2.5-Coder-7B." },
        system: { type: "string", description: "Optional system instruction." },
        temperature: { type: "number", description: "Sampling temperature (default 0.2)." },
        max_tokens: { type: "integer", description: "Max output tokens (default 2048)." },
      },
      required: ["prompt"],
    },
  },
  {
    name: "qwen_review_code",
    description:
      "Review source code with Qwen2.5-Coder-7B for bugs, edge cases, security vulnerabilities, and performance improvements.",
    inputSchema: {
      type: "object",
      properties: {
        code: { type: "string", description: "The source code to review." },
        language: { type: "string", description: "Programming language (e.g. TypeScript, Python, SQL)." },
        focus: { type: "string", description: "Optional focus area (e.g. security, bugs, readability)." },
      },
      required: ["code"],
    },
  },
  {
    name: "qwen_generate_code",
    description:
      "Generate clean, production-ready code using Qwen2.5-Coder-7B given a language and clear specification.",
    inputSchema: {
      type: "object",
      properties: {
        language: { type: "string", description: "Target language or framework." },
        specification: { type: "string", description: "What the code should do." },
      },
      required: ["language", "specification"],
    },
  },
];

async function callQwen(messages, { temperature = 0.2, max_tokens = 2048 } = {}) {
  const res = await fetch(`${LLAMA_URL}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL_NAME,
      messages,
      temperature,
      max_tokens,
      stream: false,
    }),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`llama-server returned HTTP ${res.status}: ${errText.slice(0, 400)}`);
  }
  const data = await res.json();
  return data?.choices?.[0]?.message?.content ?? "";
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept, Mcp-Session-Id",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  });
  res.end(body);
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}

function checkMcpAuth(req) {
  if (!MCP_API_KEY) return true;
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  return token === MCP_API_KEY;
}

async function handleMcpPost(req, res) {
  if (!checkMcpAuth(req)) {
    return sendJson(res, 401, {
      jsonrpc: "2.0",
      id: null,
      error: { code: -32001, message: "Unauthorized: valid Bearer MCP_API_KEY required" },
    });
  }

  let msg;
  try {
    const raw = await readBody(req);
    msg = JSON.parse(raw.toString("utf8"));
  } catch {
    return sendJson(res, 400, {
      jsonrpc: "2.0",
      id: null,
      error: { code: -32700, message: "Parse error: invalid JSON" },
    });
  }

  const { id = null, method, params = {} } = msg;

  // Notifications have no id and expect 202 Accepted
  if (method === "notifications/initialized" || (id === null && method?.startsWith("notifications/"))) {
    res.writeHead(202, { "Access-Control-Allow-Origin": "*" });
    return res.end();
  }

  if (method === "initialize") {
    return sendJson(res, 200, {
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: params.protocolVersion || "2025-03-26",
        capabilities: { tools: {} },
        serverInfo: {
          name: "qwen2.5-coder-7b-mcp",
          version: "1.0.0",
        },
      },
    });
  }

  if (method === "ping") {
    return sendJson(res, 200, { jsonrpc: "2.0", id, result: {} });
  }

  if (method === "tools/list") {
    return sendJson(res, 200, { jsonrpc: "2.0", id, result: { tools: TOOLS } });
  }

  if (method === "tools/call") {
    const toolName = params.name;
    const args = params.arguments || {};
    try {
      let text = "";
      if (toolName === "qwen_ask") {
        const messages = [];
        if (args.system) messages.push({ role: "system", content: String(args.system) });
        messages.push({ role: "user", content: String(args.prompt || "") });
        text = await callQwen(messages, {
          temperature: typeof args.temperature === "number" ? args.temperature : 0.2,
          max_tokens: typeof args.max_tokens === "number" ? args.max_tokens : 2048,
        });
      } else if (toolName === "qwen_review_code") {
        const lang = args.language ? ` (${args.language})` : "";
        const focus = args.focus ? ` Focus especially on: ${args.focus}.` : "";
        text = await callQwen([
          {
            role: "system",
            content:
              "You are Qwen2.5-Coder-7B, a senior code reviewer. Provide concise, actionable findings for bugs, security issues, and improvements.",
          },
          {
            role: "user",
            content: `Review the following code${lang}.${focus}\n\n\`\`\`\n${String(args.code || "")}\n\`\`\``,
          },
        ]);
      } else if (toolName === "qwen_generate_code") {
        text = await callQwen([
          {
            role: "system",
            content: "You are Qwen2.5-Coder-7B. Output clean, well-structured, production-ready code with minimal filler.",
          },
          {
            role: "user",
            content: `Language/Framework: ${String(args.language || "")}\n\nSpecification:\n${String(args.specification || "")}`,
          },
        ]);
      } else {
        return sendJson(res, 200, {
          jsonrpc: "2.0",
          id,
          error: { code: -32602, message: `Unknown tool: ${toolName}` },
        });
      }

      return sendJson(res, 200, {
        jsonrpc: "2.0",
        id,
        result: { content: [{ type: "text", text }] },
      });
    } catch (err) {
      return sendJson(res, 200, {
        jsonrpc: "2.0",
        id,
        result: {
          isError: true,
          content: [{ type: "text", text: `Qwen2.5-Coder-7B error: ${err?.message || String(err)}` }],
        },
      });
    }
  }

  return sendJson(res, 200, {
    jsonrpc: "2.0",
    id,
    error: { code: -32601, message: `Method not found: ${method}` },
  });
}

function proxyToLlama(req, res) {
  const target = new URL(req.url || "/", LLAMA_URL);
  const proxyReq = http.request(
    {
      hostname: target.hostname,
      port: target.port,
      path: target.pathname + target.search,
      method: req.method,
      headers: { ...req.headers, host: target.host },
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode || 502, proxyRes.headers);
      proxyRes.pipe(res, { end: true });
    },
  );
  proxyReq.on("error", (err) => {
    sendJson(res, 503, {
      status: "loading",
      message: "Qwen2.5-Coder-7B llama-server is still loading model into RAM, please retry in a few seconds.",
      detail: err.message,
    });
  });
  req.pipe(proxyReq, { end: true });
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept, Mcp-Session-Id",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    });
    return res.end();
  }

  const pathname = new URL(req.url || "/", "http://localhost").pathname;

  if (pathname === "/mcp") {
    if (req.method === "POST") return handleMcpPost(req, res);
    let llamaStatus = "starting";
    try {
      const h = await fetch(`${LLAMA_URL}/health`);
      llamaStatus = h.ok ? "ready" : `http_${h.status}`;
    } catch {
      llamaStatus = "downloading_or_loading";
    }
    return sendJson(res, 200, {
      name: "qwen2.5-coder-7b-mcp",
      protocol: "MCP Streamable HTTP (JSON-RPC 2.0 on POST /mcp)",
      model: MODEL_NAME,
      engine_status: llamaStatus,
      openai_api: "/v1/chat/completions",
      auth_required: Boolean(MCP_API_KEY),
      tools: TOOLS.map((t) => t.name),
    });
  }

  if (pathname === "/" && req.method === "GET") {
    return sendJson(res, 200, {
      service: "Tech AI Monkey — Qwen2.5-Coder-7B Engine & MCP Server",
      model: MODEL_NAME,
      endpoints: {
        mcp: "/mcp (POST JSON-RPC 2.0)",
        openai: "/v1/chat/completions",
        health: "/health",
      },
    });
  }

  if (pathname === "/health" && req.method === "GET") {
    try {
      const h = await fetch(`${LLAMA_URL}/health`);
      const txt = await h.text();
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ ok: true, llama_ready: h.ok, llama_status: h.status, detail: txt }));
    } catch {
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ ok: true, llama_ready: false, status: "downloading_or_loading_model" }));
    }
  }

  return proxyToLlama(req, res);
});

server.listen(PORT, "::", () => {
  console.log(`[qwen-mcp-gateway] Listening on [::]:${PORT} (MCP: /mcp | OpenAI API: /v1/* -> ${LLAMA_URL})`);
});
