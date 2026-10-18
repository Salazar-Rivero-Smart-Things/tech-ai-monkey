import { defineTool } from "eve/tools";
import { z } from "zod";
import { DOCUMENT_FORMATS, extractDocument, findDocument, saveExtractedText } from "../lib/docs";

export default defineTool({
  description:
    "Read a document the user attached in the chat: txt, md, rtf, doc, docx or pdf. Returns the extracted plain text so you can summarise it, answer questions about it, or translate it. Use whenever a message mentions a [Vedlagt: …] file with one of those extensions.",
  inputSchema: z.object({
    file: z
      .string()
      .describe("Stored file name from the [Vedlagt: …] line, e.g. '1730390000-kontrakt.docx'"),
    maxChars: z
      .number()
      .int()
      .min(500)
      .max(60_000)
      .optional()
      .describe("How much text to return in this call (default: everything up to 60 000 characters)"),
    offset: z.number().int().min(0).optional().describe("Start character, for reading long documents in parts"),
  }),
  async execute(input, _ctx) {
    const doc = await findDocument(input.file);
    if (!doc) {
      throw new Error(
        `Fant ingen opplastet dokumentfil som heter "${input.file}". Støttede typer: ${DOCUMENT_FORMATS.join(", ")}. Be brukeren laste opp på nytt med +-knappen.`,
      );
    }

    const extracted = await extractDocument(doc);
    const saved = await saveExtractedText(doc.file, extracted.text);

    const offset = input.offset ?? 0;
    const limit = input.maxChars ?? 60_000;
    const slice = extracted.text.slice(offset, offset + limit);

    return {
      file: extracted.file,
      format: extracted.format,
      sizeKb: Math.round(doc.sizeBytes / 1024),
      chars: extracted.chars,
      truncated: extracted.truncated || offset + limit < extracted.chars,
      offset,
      nextOffset: offset + slice.length < extracted.chars ? offset + slice.length : null,
      savedAs: saved,
      note:
        `${extracted.note}${extracted.note ? " " : ""}` +
        "Hele teksten ligger også i " +
        saved +
        " – bruk grep/bash der for å søke i lange dokumenter i stedet for å hente alt på nytt.",
      text: slice,
    };
  },
});
