import fs from 'fs';

let patchedCount = 0;

// 1. Patch .output/server/_libs/eve+zod.mjs (production bundle)
const bundleFile = '.output/server/_libs/eve+zod.mjs';
if (fs.existsSync(bundleFile)) {
  let code = fs.readFileSync(bundleFile, 'utf8');

  // Replace captureState implementation in MicrosandboxVm
  const captureRegex = /async\s+captureState\s*\(\s*e\s*\)\s*\{[\s\S]*?version:\s*2\s*\}\s*;\s*\}/;
  const newCaptureState = `async captureState(e) {
\t\tthis.#r = e;
\t\tif (this.#t !== void 0) await this.writeMetadata(this.#t, e);
\t\treturn {
\t\t\tnetworkPolicy: this.#n,
\t\t\toptionsHash: e,
\t\t\tsandboxName: this.#a,
\t\t\tstateSnapshotName: this.#o,
\t\t\tversion: 2
\t\t};
\t}`;

  if (captureRegex.test(code)) {
    code = code.replace(captureRegex, newCaptureState);
    patchedCount++;
    console.log("Patched captureState in .output bundle!");
  }

  // Prevent stop() on shutdown
  const shutdownRegex = /async\s+shutdown\s*\(\s*\)\s*\{[\s\S]*?await\s+this\.#i\.stop\(\)\.catch\(\(\)\s*=>\s*\{\}\)\s*,\s*await\s+this\.detach\(\)\s*;\s*\}/;
  const newShutdown = `async shutdown() {
\t\tclearInterval(this.#keepaliveTimer);
\t\tawait this.detach();
\t}`;

  if (shutdownRegex.test(code)) {
    code = code.replace(shutdownRegex, newShutdown);
    patchedCount++;
    console.log("Patched shutdown in .output bundle!");
  }

  fs.writeFileSync(bundleFile, code);
}

// 2. Patch node_modules/eve (source files before eve build)
const runtimeFile = 'node_modules/eve/dist/src/execution/sandbox/bindings/microsandbox-runtime.js';
if (fs.existsSync(runtimeFile)) {
  let runtimeCode = fs.readFileSync(runtimeFile, 'utf8');

  const oldCapture = /async captureState\(e\)\{if\(this\.#r=e,isEveDevEnvironment\(\)\)return this\.#t!==void 0&&await this\.writeMetadata\(this\.#t,e\),\{networkPolicy:this\.#n,optionsHash:e,sandboxName:this\.#a,stateSnapshotName:this\.#o,version:MICROSANDBOX_METADATA_VERSION\};let t=this\.#o,n=createProviderName\(`eve-sbx-state`,`\$\{this\.#e\.sessionKey\}:\$\{randomUUID\(\)\}`\);return await this\.stopAndSnapshot\(n\),this\.#o=n,this\.#t!==void 0&&await this\.writeMetadata\(this\.#t,e\),t!==void 0&&await removeSnapshotIfExists\$1\(this\.#e\.module,t\),\{networkPolicy:this\.#n,optionsHash:e,sandboxName:this\.#a,stateSnapshotName:n,version:MICROSANDBOX_METADATA_VERSION\}\}/;

  const newCapture = `async captureState(e){this.#r=e;if(this.#t!==void 0)await this.writeMetadata(this.#t,e);return{networkPolicy:this.#n,optionsHash:e,sandboxName:this.#a,stateSnapshotName:this.#o,version:MICROSANDBOX_METADATA_VERSION};}`;

  if (oldCapture.test(runtimeCode)) {
    runtimeCode = runtimeCode.replace(oldCapture, newCapture);
    patchedCount++;
    console.log("Patched captureState in node_modules/eve runtime!");
  }

  const shutdownRegex2 = /async shutdown\(\)\{await this\.#i\.stop\(\)\.catch\(\(\)=>\{\}\),await this\.detach\(\)\}/;
  const newShutdown2 = `async shutdown(){await this.detach()}`;

  if (shutdownRegex2.test(runtimeCode)) {
    runtimeCode = runtimeCode.replace(shutdownRegex2, newShutdown2);
    patchedCount++;
    console.log("Patched shutdown in node_modules/eve runtime!");
  }

  fs.writeFileSync(runtimeFile, runtimeCode);
}

// 3. Patch dev-environment.js in node_modules/eve
const devEnvFile = 'node_modules/eve/dist/src/internal/application/dev-environment.js';
if (fs.existsSync(devEnvFile)) {
  let devEnvCode = fs.readFileSync(devEnvFile, 'utf8');
  if (devEnvCode.includes('return process.env[EVE_DEV_ENV_FLAG]===`1`')) {
    devEnvCode = devEnvCode.replace(
      'return process.env[EVE_DEV_ENV_FLAG]===`1`',
      'return process.env[EVE_DEV_ENV_FLAG]===`1` || process.env.EVE_PERSIST_SANDBOX===`1` || true'
    );
    fs.writeFileSync(devEnvFile, devEnvCode);
    patchedCount++;
    console.log("Patched isEveDevEnvironment in node_modules/eve!");
  }
}

console.log(`Patch completed successfully. (${patchedCount} patches applied)`);
