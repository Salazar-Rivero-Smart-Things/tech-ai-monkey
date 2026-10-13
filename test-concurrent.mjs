import { Sandbox } from "microsandbox";

async function main() {
  const sandbox = await Sandbox.builder("test-conc").image("ghcr.io/vercel/eve:latest").replace().create();
  try {
    console.log("Starting concurrent execStreamWith...");
    const p1 = sandbox.execStreamWith("sleep", (b) => b.args(["5"]));
    const p2 = sandbox.execStreamWith("sleep", (b) => b.args(["5"]));
    await Promise.all([p1, p2]);
    console.log("Success!");
  } catch (e) {
    console.error("Failed:", e);
  } finally {
    await sandbox.stop();
  }
}
main();
