// Modern, lightweight terminal UI helpers with zero dependencies.

const useColor =
  !process.env.NO_COLOR &&
  process.env.TERM !== "dumb" &&
  (process.stdout.isTTY || Boolean(process.env.FORCE_COLOR));

function wrap(open, close) {
  return (text) => (useColor ? `\u001b[${open}m${text}\u001b[${close}m` : String(text));
}

export const bold = wrap(1, 22);
export const dim = wrap(2, 22);
export const italic = wrap(3, 23);
export const underline = wrap(4, 24);

export const red = wrap(31, 39);
export const green = wrap(32, 39);
export const yellow = wrap(33, 39);
export const blue = wrap(34, 39);
export const magenta = wrap(35, 39);
export const cyan = wrap(36, 39);
export const white = wrap(37, 39);
export const gray = wrap(90, 39);

export const bgBlue = wrap(44, 49);
export const bgCyan = wrap(46, 49);
export const bgGreen = wrap(42, 49);
export const bgYellow = wrap(43, 49);
export const bgMagenta = wrap(45, 49);

export function say(...parts) {
  process.stdout.write(parts.join(" ") + "\n");
}

export function warn(...parts) {
  process.stderr.write(yellow("▲ ") + bold("warning: ") + parts.join(" ") + "\n");
}

export function fail(...parts) {
  process.stderr.write(red("✕ ") + bold("error: ") + parts.join(" ") + "\n");
}

export function success(...parts) {
  process.stdout.write(green("✓ ") + bold(parts.join(" ")) + "\n");
}

export function badge(text, colorFn = cyan) {
  return colorFn(`[${text}]`);
}

export function heading(text) {
  say("");
  say(bold(cyan("● ") + text));
  say(dim("─".repeat(Math.max(text.length + 4, 40))));
}

export function banner() {
  const line1 = " ████████╗███████╗ ██████╗██╗  ██╗     █████╗ ██╗";
  const line2 = " ╚══██╔══╝██╔════╝██╔════╝██║  ██║    ██╔══██╗██║";
  const line3 = "    ██║   █████╗  ██║     ███████║    ███████║██║";
  const line4 = "    ██║   ██╔══╝  ██║     ██╔══██║    ██╔══██║██║";
  const line5 = "    ██║   ███████╗╚██████╗██║  ██║    ██║  ██║██║";
  const line6 = "    ╚═╝   ╚══════╝ ╚═════╝╚═╝  ╚═╝    ╚═╝  ╚═╝╚═╝";

  say(cyan(line1));
  say(cyan(line2));
  say(blue(line3));
  say(blue(line4));
  say(magenta(line5));
  say(magenta(line6));
  say(dim("       M O N K E Y   v 2 . 1   ·   A I   E N G I N E\n"));
}

export function card(lines, title = "") {
  const cleanLen = (str) => str.replace(/\u001b\[\d+m/g, "").length;
  let maxW = title ? cleanLen(title) + 4 : 45;
  for (const line of lines) {
    const l = cleanLen(line);
    if (l > maxW) maxW = l;
  }
  maxW = Math.min(Math.max(maxW + 4, 52), 76);

  const topBorder = title
    ? `┌─ ${bold(title)} ${"─".repeat(Math.max(0, maxW - cleanLen(title) - 5))}┐`
    : `┌${"─".repeat(maxW - 2)}┐`;

  say(dim(topBorder));
  for (const line of lines) {
    const pad = maxW - cleanLen(line) - 4;
    say(dim("│ ") + line + " ".repeat(Math.max(0, pad)) + dim(" │"));
  }
  say(dim(`└${"─".repeat(maxW - 2)}┘`));
}
