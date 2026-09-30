---
description: Use after learning something reusable, or when the user asks you to remember a preference, fact, or procedure.
---

# Self-improvement & knowledge curation

Keep the agent's knowledge durable and its skills library useful.

1. **Persist facts.** After a conversation, call `save_memory` for stable facts:
   who the user is, their stack, project conventions, and decisions that should
   survive future sessions. Use `remove_memory` when a stored fact is corrected
   or no longer true.
2. **Curate the library.** When you learn a repeatable procedure, check whether
   a skill under `agent/skills/` already covers it. If not, propose adding one
   (in local development you can edit your own skills and instructions).
3. **Keep it current.** Prefer the newest authoritative sources. When stored
   knowledge conflicts with what the web says today, trust the web and update
   memory accordingly.
4. **Stay scoped.** Store durable, cross-session facts in memory; do not dump
   one-off conversation details there.
