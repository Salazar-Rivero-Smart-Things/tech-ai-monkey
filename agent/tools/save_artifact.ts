import { defineTool } from "eve/tools";
import { z } from "zod";

export default defineTool({
  description:
    "Create an artifact that the user can view and download from their dashboard. Use this when you have built a complete project or scripts in your /workspace sandbox that the user wants to download. Pass `directory` when bundling a specific project folder (e.g. '/workspace/my-project').",
  inputSchema: z.object({
    title: z
      .string()
      .describe("A short, human-readable title for the artifact, e.g. 'Flower Shop Website'"),
    kind: z
      .string()
      .describe("The type of artifact, e.g. 'project', 'html', 'python', 'bash'"),
    directory: z
      .string()
      .optional()
      .describe(
        "Optional project directory inside /workspace to bundle (e.g. '/workspace/processs_tool' or 'processs_tool'). Defaults to '/workspace'.",
      ),
  }),
  async execute({ title, kind, directory }, ctx) {
    const authCurrent = (ctx.session.auth?.current ?? null) as
      | { subject?: string; principalId?: string }
      | null;
    const rawUserId = authCurrent?.subject ?? authCurrent?.principalId;
    const userId = rawUserId?.replace(/^[^:]+:/, "").trim();
    if (!userId) {
      throw new Error("No user authenticated. Cannot save artifact.");
    }

    const sandbox = await ctx.getSandbox();

    let targetDir = "/workspace";
    if (directory && directory.trim()) {
      const cleaned = directory.trim().replace(/^\/+/, "");
      targetDir = cleaned.startsWith("workspace/")
        ? `/${cleaned}`
        : cleaned === "workspace"
          ? "/workspace"
          : `/workspace/${cleaned}`;
    }

    const quotedDir = `'${targetDir.replace(/'/g, `'\\''`)}'`;

    // Find all text/source files in targetDir (ignoring hidden files, node_modules, and binary archives)
    const result = await sandbox.run({
      command: [
        `find ${quotedDir} -type f`,
        `-not -path '*/\\.*'`,
        `-not -path '*/node_modules/*'`,
        `-not -path '*/__pycache__/*'`,
        `-not -path '*/venv/*'`,
        `-not -name '*.tar.gz'`,
        `-not -name '*.tgz'`,
        `-not -name '*.zip'`,
        `-not -name '*.gz'`,
        `-not -name '*.dmg'`,
        `-not -name '*.deb'`,
        `-not -name '*.exe'`,
        `-not -name '*.png'`,
        `-not -name '*.jpg'`,
        `-not -name '*.jpeg'`,
        `-not -name '*.webp'`,
        `-not -name '*.ico'`,
        `-not -name '*.pdf'`,
        `-not -name '*.woff*'`,
      ].join(" "),
      abortSignal: AbortSignal.timeout(10000),
    });

    if (result.exitCode !== 0) {
      throw new Error("Failed to list files in workspace: " + result.stderr);
    }

    const filePaths = result.stdout
      .split("\n")
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
    const files: Array<{ path: string; content: string }> = [];

    for (const filePath of filePaths) {
      try {
        const content = await sandbox.readTextFile({ path: filePath });
        files.push({
          path: filePath.replace(/^\/workspace\/?/, ""),
          content,
        });
      } catch (err) {
        console.warn("Skipping non-UTF8 or unreadable file in artifact:", filePath, err);
      }
    }

    if (files.length === 0) {
      throw new Error(`No readable project files found in ${targetDir}.`);
    }

    const res = await fetch("http://127.0.0.1:3000/api/artifacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, title, kind, files }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Failed to save artifact: ${err}`);
    }

    return {
      ok: true,
      fileCount: files.length,
      files: files.map((f) => f.path),
      message: `Artifact '${title}' created successfully with ${files.length} files! Tell the user they can find it in their Dashboard -> Artifacts, where they can view and download it.`,
    };
  },
});

