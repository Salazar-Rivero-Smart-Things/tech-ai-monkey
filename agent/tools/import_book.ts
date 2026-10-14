import { defineTool } from "eve/tools";
import { z } from "zod";
import {
  countWords,
  extractBookText,
  findHostBook,
  listHostBooks,
  sandboxBookPath,
} from "../lib/books";

export default defineTool({
  description:
    "Convert one book from the server's book library to plain text and copy it into the sandbox, so read_file, grep and bash can work with it. PDF is converted with pdftotext and EPUB from its reading order. Use when the user wants to read or be taught a book. Read the result in chunks — never paste the whole book into the chat.",
  inputSchema: z.object({
    book: z
      .string()
      .describe('Which book to import: the file name from list_books, e.g. "atomic-habits.pdf".'),
  }),
  async execute({ book }, ctx) {
    const found = await findHostBook(book);
    if (!found) {
      const available = (await listHostBooks()).map((entry) => entry.file);
      return {
        ok: false,
        error: `No book in the library matched "${book}".`,
        available,
        hint: available.length
          ? "Call import_book again with one of these file names."
          : "The owner has to drop the book file into the server's book library first.",
      };
    }

    let text: string;
    let notes: string[];
    try {
      ({ text, notes } = await extractBookText(found));
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
        sourceFile: found.file,
      };
    }

    if (!text.trim()) {
      return {
        ok: false,
        error: `"${found.file}" produced no readable text — it may be a scanned PDF without a text layer.`,
        hint: "Tell the user the file needs OCR, or to drop a text version of the book in the library.",
      };
    }

    const path = sandboxBookPath(found);
    let sandboxPath: string;
    try {
      const sandbox = await ctx.getSandbox();
      await sandbox.writeTextFile({ path, content: text });
      sandboxPath = sandbox.resolvePath(path);
    } catch (error) {
      return {
        ok: false,
        error: `Could not copy the book into the sandbox: ${
          error instanceof Error ? error.message : String(error)
        }`,
        hint: "Check the sandbox on the server (`node_modules/.bin/msb list`), then try again.",
      };
    }

    return {
      ok: true,
      title: found.title,
      sourceFile: found.file,
      sandboxPath,
      characters: text.length,
      words: countWords(text),
      notes,
      nextStep: `Read ${sandboxPath} in chunks (read_file with startLine/endLine) to find the table of contents, then teach it one part at a time and ask the user a question before moving on.`,
    };
  },
});
