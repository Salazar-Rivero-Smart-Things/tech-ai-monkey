import { defineChannel, GET } from "eve/channels";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

// Replaces eve's default landing page at `/` with the web chat UI. The chat
// page talks to the default eve channel at /eve/v1/* on the same origin, so no
// CORS configuration is needed.
//
// The HTML is read from disk at request time instead of importing it with
// `?raw` — the `?raw` import works in `eve dev` but fails during `eve build`.
// `process.cwd()` is the project root in both dev and `eve start`.
const chatHtmlPath = join(process.cwd(), "public", "index.html");

export default defineChannel({
  routes: [
    GET("/", async () => {
      const html = await readFile(chatHtmlPath, "utf8").catch(() => null);
      if (html === null) {
        return new Response("Chat UI not found.", { status: 404 });
      }
      return new Response(html, {
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }),
  ],
});
