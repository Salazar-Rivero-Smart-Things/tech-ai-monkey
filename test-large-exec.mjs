import { Sandbox } from "microsandbox";

async function main() {
  const sandbox = await Sandbox.builder("test-large").image("ghcr.io/vercel/eve:latest").replace().create();
  try {
    const hugeString = "a".repeat(200 * 1024); // 200 KB
    const script = `cat << 'INNER_EOF' > file.txt\n${hugeString}\nINNER_EOF`;
    
    console.log("Sending script of length:", script.length);
    const p1 = sandbox.execStreamWith("bash", (b) => b.args(["-c", script]));
    
    await Promise.all([p1]);
    console.log("Success!");
    
    // Now try second exec to see if it says no agent socket found
    console.log("Trying second exec...");
    await sandbox.execStreamWith("bash", (b) => b.args(["-c", "echo alive"]));
    console.log("Still alive!");
  } catch (e) {
    console.error("Failed:", e);
  } finally {
    await sandbox.stop();
  }
}
main();
