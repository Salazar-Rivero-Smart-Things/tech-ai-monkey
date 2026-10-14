import { defineTool } from "eve/tools";
import { z } from "zod";
import { SANDBOX_BOOKS_DIR, booksDir, listHostBooks } from "../lib/books";

export default defineTool({
  description:
    "List the books the agent can teach from: the files the owner has dropped into the server's book library, plus the books already converted and copied into the sandbox. Use when the user asks which books are available, when they want to learn from a book, or before calling import_book.",
  inputSchema: z.object({}),
  async execute(_input, ctx) {
    const books = await listHostBooks();

    let inSandbox: string[] | null = null;
    let sandboxError: string | null = null;
    try {
      const sandbox = await ctx.getSandbox();
      const result = await sandbox.run({
        command: `ls -1 ${SANDBOX_BOOKS_DIR} 2>/dev/null || true`,
      });
      inSandbox = result.stdout
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
    } catch (error) {
      sandboxError = error instanceof Error ? error.message : String(error);
    }

    return {
      libraryDir: booksDir(),
      available: books.map((book) => ({
        file: book.file,
        title: book.title,
        format: book.format,
        sizeKb: Math.round(book.sizeBytes / 1024),
      })),
      alreadyInSandbox: inSandbox,
      ...(sandboxError ? { sandboxError } : {}),
      nextStep:
        books.length > 0
          ? "Call import_book with the file name to convert the book and copy it into the sandbox, then teach it one part at a time."
          : `The library is empty. Tell the user to drop the book file (${booksDir()}) on the server, then call this tool again.`,
      note: `Converted books live at /workspace/${SANDBOX_BOOKS_DIR}/ and are read with read_file, grep or bash — never paste a whole book into the chat.`,
    };
  },
});
