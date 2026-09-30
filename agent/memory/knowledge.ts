import { defineMemory } from "eve/memory";
import { byPrincipal } from "eve/memory/scope";
import { fileMemory } from "eve/memory/file";

// Cross-session memory: the agent keeps learning between conversations.
// `fileMemory` gives the model `save_memory` and `remove_memory` tools; in
// `eve dev` it stores locally, and on Vercel it uses Vercel Blob.
export default defineMemory({
  description:
    "Remember stable facts, preferences, and decisions about the caller across sessions.",
  provider: fileMemory(),
  scope: byPrincipal,
});
