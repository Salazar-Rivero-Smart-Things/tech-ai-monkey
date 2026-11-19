---
name: Conversation History
description: Use when the user asks to view their conversation history, recent chats, past tasks, or previous projects (in English, Norwegian, or Spanish).
triggers: history, chat history, recent conversations, last tasks, last projects, historikk, samtalehistorikk, siste samtaler, historial, historial de conversaciones, conversaciones recientes
scope: global
createdBy: owner
updatedAt: 2026-11-19T18:30:00.000Z
---

# Show Conversation History

When the user asks to see their conversation history, recent chats, or past tasks:

1. **Fetch real history:** Call the `get_chat_history` tool right away.
   - Pass `query` if the user is searching for a specific topic or project.
   - Pass `conversationId` if the user asks to inspect the full messages of a specific thread from the list.
   - Pass `limit` (default `10`) for general history requests.
2. **Format clearly in the user's language** (English, Norwegian, or Spanish):
   - Present a clean numbered list with each conversation's **title**, **date/time**, **message count**, and a short **preview**.
   - If the list is empty, let the user know no previous chats are saved yet and that new chats are saved automatically.
3. **Point to the History tab:** Mention that all recent conversations can also be browsed, searched, renamed, deleted, or resumed directly in **Dashboard → History** (`/dashboard/history`).
