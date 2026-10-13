import { defineTool } from "eve/tools";
import { z } from "zod";

export default defineTool({
  description: "Create an artifact that the user can view and download from their dashboard. Use this when you have built a complete project or a large file in your sandbox that the user wants to download. It will automatically bundle ALL files currently in your /workspace sandbox and save them.",
  inputSchema: z.object({
    title: z.string().describe("A short, human-readable title for the artifact, e.g. 'Flower Shop Website'"),
    kind: z.string().describe("The type of artifact, e.g. 'project', 'html', 'python'"),
  }),
  async execute({ title, kind }, ctx) {
    const userId = ctx.session.auth?.current?.principalId;
    if (!userId) {
      throw new Error("No user authenticated. Cannot save artifact.");
    }

    const sandbox = await ctx.getSandbox();
    
    // Find all files in the workspace (ignoring hidden files and node_modules)
    const result = await sandbox.run({
      command: "find /workspace -type f -not -path '*/\\.*' -not -path '*/node_modules/*'",
      abortSignal: AbortSignal.timeout(5000)
    });
    
    if (result.exitCode !== 0) {
      throw new Error("Failed to list files in workspace: " + result.stderr);
    }
    
    const filePaths = result.stdout.split('\n').filter(p => p.trim().length > 0);
    const files = [];
    
    for (const filePath of filePaths) {
      try {
        const content = await sandbox.readTextFile({ path: filePath });
        files.push({
          path: filePath.replace('/workspace/', ''),
          content
        });
      } catch (err) {
        console.error("Failed to read", filePath, err);
      }
    }

    const res = await fetch("http://127.0.0.1:3000/api/artifacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, title, kind, files })
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Failed to save artifact: ${err}`);
    }

    return { ok: true, message: `Artifact created successfully with ${files.length} files! Tell the user they can find it in their Dashboard -> Artifacts, where they can view and download it.` };
  }
});
