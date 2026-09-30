import { defineChannel, GET } from "eve/channels";
import chatHtml from "../../public/index.html?raw";

// Replaces eve's default landing page at `/` with the web chat UI. The chat
// page talks to the default eve channel at /eve/v1/* on the same origin, so no
// CORS configuration is needed.
export default defineChannel({
  routes: [
    GET("/", async () =>
      new Response(chatHtml, {
        headers: { "content-type": "text/html; charset=utf-8" },
      }),
    ),
  ],
});
