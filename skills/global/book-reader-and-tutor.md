---
name: Book reader and tutor
description: Use when the user wants to read a book or document and be taught its content — read a book (PDF/EPUB/TXT/MD) and teach it, start teaching from a book, or be quizzed on what was read last time.
triggers: Les boken [boknavn] og lær meg den, Start undervisning fra boken [boknavn], Quiz meg på det vi leste sist, teach me this book, start teaching from the book, quiz me on what we read last time
scope: global
createdBy: local-dev
updatedAt: 2026-10-14T01:32:05.000Z
---

# Read a book and teach it pedagogically

**Purpose:** Read a book or document (PDF/EPUB/TXT/MD), work out what it really
says, and teach it to the user through interactive dialogue, everyday analogies
and comprehension questions.

## Behaviour rules

- **Do not dump the summary (high).** Never paste the whole summary at once.
  Split the book into logical parts/chapters and take them one at a time.
- **Feynman method (high).** Explain complex concepts in simple words and
  everyday analogies. If you cannot, you have not understood it well enough.
- **Interactive dialogue (medium).** After explaining a concept, always ask 1–2
  comprehension or reflection questions.
- **Pace to the user (medium).** Wait until the user has answered or confirmed
  before moving on to the next topic.

## Prerequisites

- Start with `list_books`: it shows the books in the server's library and which
  of them are already in the sandbox.
- If the book is in the library but not in the sandbox, call `import_book` with
  its file name. That converts PDF/EPUB to text and puts it at
  `/workspace/books/<slug>.txt`.
- **If the library is empty, stop and ask the user** to drop the book file in the
  server's `books/` folder. Never invent the content of a book you cannot read.
- Read the book with `read_file` and `grep` — never paste it into the chat. A
  whole book is far more text than one reply can hold.

## Steps

### Step 1 — Map the book

1. Read the start of the file and `grep` for chapter headings to find the table
   of contents and the introduction.
2. Give the user a **three-sentence** overview of the book's core message.
3. Present the chapter list and ask which topic to start with.

### Step 2 — Deep dive and teaching

1. Read the chosen chapter and extract its **three most important points**.
2. Explain each point with a practical, real-world example.
3. Highlight important quotes, models or frameworks.

### Step 3 — Check understanding

1. Ask the user an open question about how they would apply this in practice.
2. Give constructive feedback on the answer and correct any misunderstanding
   before moving on.

### Step 4 — Save the study notes

1. Create or update `<book-title>_notater.md` — a cheat sheet with the key
   points, important quotes and flashcards/keywords per chapter.
2. Build it up as the teaching progresses, so the file becomes the user's
   revision sheet for the whole book.
3. Bundle it with `save_artifact` (kind `notes`) and tell the user it is
   available under **Dashboard → Artifacts**.

## Resuming a session

When the user says "quiz me on what we read last time", read the existing
`<book-title>_notater.md` (and `list_memories`) to find where the session
stopped, then continue from there instead of starting over.

## Success criteria

- The book's structure and core message are mapped.
- The user has understood the main concepts, shown by their own answers in the
  dialogue — not just by reading a summary.
- The key learning points are stored in a summary file.
