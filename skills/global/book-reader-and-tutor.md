---
name: Book reader and tutor
description: Use when the user wants to read a book or document and be taught its content — read a book (PDF/EPUB/TXT/MD) and teach it, start teaching from a book, or be quizzed on what was read last time.
triggers: Les boken [boknavn] og lær meg den, Start undervisning fra boken [boknavn], Fortsett å lære meg, Fortsett fra der vi slapp, forsett, fortsett, gå videre, neste, Lær meg Python 3 fra boken [boknavn], Quiz meg på det vi leste sist, teach me this book, start teaching from the book, continue teaching me, continue where we left off, quiz me on what we read last time
scope: global
createdBy: local-dev
updatedAt: 2026-10-14T02:15:00.000Z
---

# Read a book and teach it pedagogically

**Purpose:** Read a book or document (PDF/EPUB/TXT/MD), work out what it really
says, and teach it to the user through interactive dialogue, everyday analogies
and comprehension questions.

## Behaviour rules

- **CRITICAL ANTI-LOOP RULE (highest):** NEVER repeat the book introduction,
  summary, or table of contents if you have already shown it in the conversation!
  If the user writes "forsett", "fortsett", "start", "kjør på", "ja", or picks a chapter:
  DO NOT call `list_books` again, DO NOT re-import, and DO NOT print the book overview again.
  IMMEDIATELY proceed to **Step 2 (Deep dive and teaching)** for the first (or next)
  chapter.
- **Do not dump the summary (high).** Never paste the whole summary at once.
  Split the book into logical parts/chapters and take them one at a time.
- **Feynman method (high).** Explain complex concepts in simple words and
  everyday analogies. If you cannot, you have not understood it well enough.
- **Interactive dialogue (medium).** After explaining a concept, always ask 1–2
  comprehension or reflection questions.
- **Pace to the user (medium).** Wait for an answer or confirmation before
  moving on. A direct request such as "continue", "fortsett", "forsett", "neste",
  or "go on" is valid confirmation: proceed to the next uncompleted part without
  repeating the previous explanation, without showing the table of contents again,
  and without asking the user to choose.
- **Keep place (high).** Treat the conversation as a lesson with a cursor:
  remember the last completed chapter/concept and the next one to teach. On
  "continue" or "forsett", check the conversation first and the study notes if needed, then
  teach that next part. Do not restart the book map, repeat the overview, or
  ask which chapter to choose again. If no lesson has started yet, start with Chapter 1
  immediately.
- **Teach current Python (high).** When the user wants to learn modern Python
  from an old book, use the book for concepts and structure, but teach current
  Python 3 practice. Clearly flag outdated syntax, APIs, and recommendations;
  verify current equivalents against official Python documentation or release
  notes, and keep book content and modern updates distinct.

## Prerequisites

- If the book is not yet in the sandbox, check `list_books` and call `import_book`.
- **If the book is ALREADY in the sandbox or conversation, SKIP PREREQUISITES AND STEP 1 COMPLETELY.**
- Read the book with `read_file` and `grep` — never paste it into the chat. A
  whole book is far more text than one reply can hold.

## Steps

### Step 1 — Map the book (ONLY on the very first turn)

1. Read the start of the file and `grep` for chapter headings to find the table
   of contents and the introduction.
2. Give the user a **three-sentence** overview of the book's core message.
3. Present a compact chapter list, and **in the very same reply**, begin teaching
   the first concept of Chapter 1! Do NOT end with "du bestemmer" without starting.

### Step 2 — Deep dive and teaching

1. Read the chosen chapter and extract its **three most important points**.
2. Explain each point with a practical, real-world example.
3. Highlight important quotes, models or frameworks.

### Step 3 — Check understanding

1. Ask the user an open question about how they would apply this in practice.
2. Give constructive feedback on the answer and correct any misunderstanding
   before moving on.

### Step 4 — Save the study notes

1. Create or update `<book-title>_notater.md` after each taught part — a cheat
   sheet with key points, important quotes and flashcards/keywords per chapter.
2. Record the last completed part and the next part to teach so "continue" can
   resume without repeating material.
3. Build the notes up as teaching progresses. Only bundle them with
   `save_artifact` (kind `notes`) when the user asks for a downloadable copy;
   otherwise keep teaching and do not let artifact creation interrupt the
   lesson.

## Resuming a session

When the user says "continue", "fortsett", or "quiz me on what we read last
time", use the conversation and existing `<book-title>_notater.md` (and
`list_memories` if relevant) to find where the session stopped. Continue at the
next uncompleted part instead of starting over. A quiz request means ask a new
question about material already taught; a continue request means teach the next
part.

## Success criteria

- The book's structure and core message are mapped.
- The user has understood the main concepts, shown by their own answers in the
  dialogue — not just by reading a summary.
- The key learning points are stored in a summary file.
