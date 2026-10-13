---
description: Use after learning something reusable, or when the user asks you to remember a preference, fact, or procedure.
---

# Self-improvement & knowledge curation

Keep the agent's knowledge durable and its skills library useful.

1. **Persist facts.** After a conversation, call `remember` for stable facts:
   who the user is, their stack, project conventions, and decisions that should
   survive future sessions. Use `forget` when a stored fact is corrected
   or no longer true, and `list_memories` to review what is saved.
2. **Curate the library.** When you learn a repeatable procedure, check whether
   a skill already covers it with `list_skills`. If not, save it with
   `learn_skill`: a short name, a description written as the question that should
   trigger it, the procedure as markdown, and a few example triggers. Default to
   `scope: "personal"`; only publish `scope: "global"` when the user explicitly
   asks for *everybody* and you are the instance owner. Overwriting a name
   updates that skill; `forget_skill` removes one. Authored, built-in skills
   under `agent/skills/` are edited in the repo instead (in local development you
   can edit your own skills and instructions).
3. **Keep it current.** Prefer the newest authoritative sources. When stored
   knowledge conflicts with what the web says today, trust the web and update
   memory accordingly.
4. **Stay scoped.** Store durable, cross-session facts in memory; do not dump
   one-off conversation details there.
