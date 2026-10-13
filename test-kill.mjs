import { Sandbox } from "microsandbox";

async function main() {
  const sandbox = await Sandbox.builder("test-kill").image("ghcr.io/vercel/eve:latest").replace().create();
  try {
    const handle = await sandbox.execStreamWith("bash", (b) => b.args(["-c", "sleep 10"]));
    
    // Call kill() on the handle
    console.log("Calling kill()...");
    await handle.kill();
    
    console.log("Waiting to see if sandbox survives...");
    await new Promise(r => setTimeout(r, 2000));
    
    // Try to run something else
    console.log("Running second command...");
    const res = await sandbox.shell("echo alive");
    console.log("Alive!", res.stdout);
    
  } catch (e) {
    console.error("Failed:", e);
  } finally {
    await sandbox.stop();
  }
}
main();
