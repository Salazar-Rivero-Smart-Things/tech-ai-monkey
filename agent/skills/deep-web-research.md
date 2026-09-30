---
description: Use when the user asks to find, research, debug, or fix an issue by searching the web until it is resolved.
---

# Deep web research procedure

Follow this procedure whenever the user needs current facts, a root cause, or a
working fix. Do not stop at the first search result.

1. **Define the target.** Restate the question or issue in one sentence and list
   the exact information that would resolve it.
2. **Search broadly first.** Call `web_search` with 3–5 different phrasings:
   the error message, the symptom, the library/version, and the goal.
3. **Open the best sources.** Use `web_fetch` on primary sources (official docs,
   GitHub issues, changelogs, bug trackers) before blogs or forums.
4. **Narrow and verify.** Search again with the most specific terms you learned,
   and cross-check any fix against at least two independent sources.
5. **Iterate until resolved.** Keep searching with new query variants until you
   have found the root cause and a working fix, or you have exhaustively ruled
   out the obvious candidates. Track what you ruled out so you don't repeat it.
6. **Report with sources.** Summarize the answer, the fix, and the confidence
   level, and list the URLs you relied on. If unresolved, say exactly what
   remains unknown and what to try next.
