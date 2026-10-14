# Book library

Drop the book you want the agent to teach you in this folder, then ask in chat:
*"Les boken \<tittel\> og lær meg den"*. The agent calls `list_books`, then
`import_book`, which converts the file to plain text and copies it into its
sandbox at `/workspace/books/<slug>.txt` — where `read_file`, `grep` and `bash`
can work with it.

| Format | Converted with |
| --- | --- |
| `.txt`, `.md`, `.markdown`, `.text` | read as-is |
| `.pdf` | `pdftotext -layout` (from `poppler-utils`) |
| `.epub` | `unzip`, chapters in the OPF spine order |

Things worth knowing:

- The conversion runs **on the server**, because the sandbox image has no PDF or
  EPUB tooling. Only plain text crosses into the sandbox.
- A scanned PDF without a text layer comes out empty — it needs OCR first.
- Override the folder with `EVE_BOOKS_DIR`.
- This folder is git-ignored. Books are usually copyrighted and this repository
  is public, so book files must never be committed.

The procedure the agent follows is the *Book reader and tutor* skill
(`skills/global/book-reader-and-tutor.md`): map the book, teach one part at a
time, check understanding, and save the notes as a study sheet.
