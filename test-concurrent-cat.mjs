import { Sandbox } from "microsandbox";

async function main() {
  const sandbox = await Sandbox.builder("test-conc-cat").image("ghcr.io/vercel/eve:latest").replace().create();
  try {
    const promises = [];
    for (let i = 0; i < 20; i++) {
      promises.push(sandbox.execStreamWith("bash", (b) => b.args(["-c", "cat << 'INNER_EOF' >> file.txt\nhello\nINNER_EOF"])));
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
