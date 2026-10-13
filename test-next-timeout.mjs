import { Sandbox } from "microsandbox";

async function main() {
  const sandbox = await Sandbox.builder("test-timeout").image("ghcr.io/vercel/eve:latest").replace().create();
  try {
    const handle = await sandbox.execStreamWith("bash", (b) => b.args(["-c", "echo hello; sleep 1"]));
    const iterator = handle[Symbol.asyncIterator]();
    
    // Read first output
    console.log(await iterator.next());
    
    // Immediately call return to simulate aborting the stream while the process is still running
    console.log("Calling return()...");
    await iterator.return();
    
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
