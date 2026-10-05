// Tiny terminal helpers — no dependencies, so the CLI compiles to a single file.

const useColor =
  !process.env.NO_COLOR &&
  process.env.TERM !== "dumb" &&
  (process.stdout.isTTY || Boolean(process.env.FORCE_COLOR));

function wrap(open, close) {
  return (text) => (useColor ? `\u001b[${open}m${text}\u001b[${close}m` : String(text));
}

export const bold = wrap(1, 22);
export const dim = wrap(2, 22);
export const green = wrap(32, 39);
export const yellow = wrap(33, 39);
export const red = wrap(31, 39);
export const cyan = wrap(36, 39);

export function say(...parts) {
  process.stdout.write(parts.join(" ") + "\n");
}

export function warn(...parts) {
  process.stderr.write(yellow("warning: ") + parts.join(" ") + "\n");
}

export function fail(...parts) {
  process.stderr.write(red("error: ") + parts.join(" ") + "\n");
}

export function heading(text) {
  say("");
  say(bold(text));
  say(dim("─".repeat(Math.min(text.length + 2, 60))));
}
