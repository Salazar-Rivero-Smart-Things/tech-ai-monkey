"use client";

import { useState } from "react";

/**
 * A fenced code block with a copy button. Used on the /docs pages so the
 * VS Code configuration can be pasted without retyping it.
 */
export default function CopyBlock({
  code,
  className = "",
}: {
  code: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked (insecure origin, permissions) — the user can
      // still select the text manually.
    }
  }

  return (
    <div className={`relative ${className}`}>
      <pre className="overflow-x-auto rounded-md border border-zinc-800 bg-black/60 p-4 pr-20 font-mono text-xs leading-relaxed text-zinc-300">
        <code>{code}</code>
      </pre>
      <button
        type="button"
        onClick={copy}
        aria-label="Copy to clipboard"
        className="absolute right-2 top-2 rounded border border-zinc-700 bg-zinc-900/90 px-2 py-1 text-[11px] text-zinc-300 transition hover:bg-zinc-800"
      >
        {copied ? "Copied ✓" : "Copy"}
      </button>
    </div>
  );
}
