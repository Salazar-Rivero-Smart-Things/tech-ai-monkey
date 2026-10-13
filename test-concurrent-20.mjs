import { Sandbox } from "microsandbox";

async function main() {
  const sandbox = await Sandbox.builder("test-conc-20").image("ghcr.io/vercel/eve:latest").replace().create();
  try {
    const promises = [];
    for (let i = 0; i < 20; i++) {
      promises.push(sandbox.execStreamWith("sleep", (b) => b.args(["2"])));
    }
    
    await Promise.all(promises);
    console.log("Success!");
  } catch (e) {
    console.error("Failed:", e);
  } finally {
    await sandbox.stop();
  }
}
main();
