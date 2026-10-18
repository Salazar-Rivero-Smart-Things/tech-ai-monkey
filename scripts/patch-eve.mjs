import fs from 'fs';

let patchedCount = 0;

// Wrap MicrosandboxVm's native handle so a crashed VM is recovered and the
// failed operation is retried instead of failing the whole turn with
// "[AgentClient] ... Connection refused".
const RECOVERY_HELPERS = `
\t#isStaleSandboxError(e) {
\t\tlet t = String(e && e.message ? e.message : e);
\t\treturn /AgentClient|Connection refused|ECONNREFUSED|os error 111|failed to connect|no such file or directory.*\\.sock|sandbox.*(not running|crashed|stopped|missing)/i.test(t);
\t}
\tasync #recoverSandbox() {
\t\tconsole.warn(\`[eve:microsandbox] connection lost for \${this.#a}, recovering...\`);
\t\ttry {
\t\t\tlet t = await this.#e.module.Sandbox.get(this.#a);
\t\t\tlet n = t.status === \`running\` || t.status === \`draining\` ? await t.connectWithTimeout(5e3) : await t.startDetached();
\t\t\tawait n.execWith(\`bash\`, (e) => e.args([\`-c\`, \`true\`]).cwd(WORKSPACE_ROOT).user(MICROSANDBOX_USER));
\t\t\tthis.#i = this.#wrapHandle(n);
\t\t\treturn true;
\t\t} catch {}
\t\ttry {
\t\t\tawait removeSandboxIfExists(this.#e.module, this.#a);
\t\t\tlet t = createProviderName(\`eve-sbx-ses\`, \`\${this.#e.sessionKey}:\${randomUUID()}\`);
\t\t\tlet n = await createMicrosandbox({
\t\t\t\tfromSnapshot: this.#o,
\t\t\t\tmodule: this.#e.module,
\t\t\t\tname: t,
\t\t\t\tnetworkPolicy: this.#n,
\t\t\t\toptions: this.#e.options,
\t\t\t\ttags: this.#e.tags,
\t\t\t\tuser: MICROSANDBOX_USER,
\t\t\t\tworkdir: WORKSPACE_ROOT
\t\t\t});
\t\t\tthis.#i = this.#wrapHandle(n);
\t\t\tthis.#a = t;
\t\t\tthis.#t !== void 0 && this.#r !== void 0 && await this.writeMetadata(this.#t, this.#r);
\t\t\treturn true;
\t\t} catch {
\t\t\treturn false;
\t\t}
\t}
\t#wrapHandle(e) {
\t\tthis.__microsandboxRawHandle = e;
\t\tlet t = this, n = (r) => new Proxy(r, {
\t\t\tget(i, a) {
\t\t\t\tlet o = i[a];
\t\t\t\tif (typeof o !== \`function\`) return o;
\t\t\t\treturn (...s) => {
\t\t\t\t\tlet c = o.apply(i, s);
\t\t\t\t\treturn c && typeof c.catch === \`function\` ? c.catch(async (l) => {
\t\t\t\t\t\tif (!t.#isStaleSandboxError(l)) throw l;
\t\t\t\t\t\tif (!(await t.#recoverSandbox())) throw l;
\t\t\t\t\t\treturn t.__microsandboxRawHandle.fs()[a](...s);
\t\t\t\t\t}) : c;
\t\t\t\t};
\t\t\t}
\t\t});
\t\treturn new Proxy(e, {
\t\t\tget(r, i) {
\t\t\t\tlet a = r[i];
\t\t\t\tif (typeof a !== \`function\`) return a;
\t\t\t\tif (i === \`fs\`) return () => n(a.call(r));
\t\t\t\treturn (...o) => {
\t\t\t\t\tlet s = a.apply(r, o);
\t\t\t\t\treturn s && typeof s.catch === \`function\` ? s.catch(async (c) => {
\t\t\t\t\t\tif (!t.#isStaleSandboxError(c)) throw c;
\t\t\t\t\t\tif (!(await t.#recoverSandbox())) throw c;
\t\t\t\t\t\treturn t.__microsandboxRawHandle[i](...o);
\t\t\t\t\t}) : s;
\t\t\t\t};
\t\t\t}
\t\t});
\t}
`;

function patchMicrosandboxRecovery(code) {
  if (code.includes('#recoverSandbox')) return code;

  const ctorRegex = /constructor\(e\s*,\s*t\s*,\s*n\s*,\s*r\s*,\s*i\s*,\s*a\s*,\s*o\)\s*\{[^}]*\}/;
  if (!ctorRegex.test(code)) return code;

  let patched = code.replace(ctorRegex, (match) => match + RECOVERY_HELPERS);

  const handleRegex = /this\.#i\s*=\s*t(?=\s*[,;}])/;
  if (!handleRegex.test(patched)) return code;
  patched = patched.replace(handleRegex, 'this.#i = this.#wrapHandle(t)');

  const networkRegex = /this\.#i\s*=\s*(await createMicrosandbox\(\{[\s\S]*?\}\))/;
  if (!networkRegex.test(patched)) return code;
  patched = patched.replace(networkRegex, (match, created) => `this.#i = this.#wrapHandle(${created})`);

  return patched;
}

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

  // Add liveness probe + auto-recovery to connectMicrosandbox in .output bundle (idempotent)
  const connectBundleRegex = /async\s+function\s+connectMicrosandbox\s*\(\s*e\s*\)\s*\{[\s\S]*?(?=async\s+function\s+restoreMicrosandboxSessionSnapshot\s*\()/;
  const newConnectBundle = `async function connectMicrosandbox(e) {
\tlet t;
\ttry {
\t\tt = await e.module.Sandbox.get(e.metadata.sandboxName);
\t} catch (t) {
\t\tif (!isMicrosandboxNotFoundError(t)) throw t;
\t\treturn e.metadata.stateSnapshotName === void 0 ? null : await restoreMicrosandboxSessionSnapshot(e);
\t}
\tif (t.status !== \`running\` && t.status !== \`draining\` && e.metadata.stateSnapshotName !== void 0) return await restoreMicrosandboxSessionSnapshot(e);
\ttry {
\t\tlet n = t.status === \`running\` || t.status === \`draining\` ? await t.connectWithTimeout(5e3) : await t.startDetached();
\t\tawait Promise.race([
\t\t\t(async () => {
\t\t\t\tawait n.execWith(\`bash\`, (b) => b.args([\`-c\`, \`true\`]).cwd(WORKSPACE_ROOT).user(MICROSANDBOX_USER));
\t\t\t\tawait n.fs().exists(WORKSPACE_ROOT);
\t\t\t})(),
\t\t\tnew Promise((_, rej) => setTimeout(() => rej(new Error(\`Microsandbox probe timed out\`)), 4e3))
\t\t]);
\t\treturn new MicrosandboxVm({
\t\t\tmodule: e.module,
\t\t\toptions: e.options,
\t\t\tsessionKey: e.sessionKey,
\t\t\ttags: e.tags
\t\t}, n, e.metadata.sandboxName, e.metadata.networkPolicy, e.metadataPath, e.metadata.optionsHash, e.metadata.stateSnapshotName);
\t} catch (err) {
\t\tconsole.warn(\`[eve:microsandbox] Stale sandbox \${e.metadata.sandboxName} (\${err?.message}), recreating...\`);
\t\tawait removeSandboxIfExists(e.module, e.metadata.sandboxName).catch(() => {});
\t\treturn null;
\t}
}\n`;

  if (connectBundleRegex.test(code)) {
    code = code.replace(connectBundleRegex, newConnectBundle);
    patchedCount++;
    console.log("Patched connectMicrosandbox liveness probe in .output bundle!");
  }

  const bundleWithRecovery = patchMicrosandboxRecovery(code);
  if (bundleWithRecovery !== code) {
    code = bundleWithRecovery;
    patchedCount++;
    console.log("Patched MicrosandboxVm crash recovery in .output bundle!");
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

  const connectRuntimeRegex = /async function connectMicrosandbox\(e\)\{[\s\S]*?(?=async function restoreMicrosandboxSessionSnapshot\(e\))/;

  const newConnectRuntime = `async function connectMicrosandbox(e){let t;try{t=await e.module.Sandbox.get(e.metadata.sandboxName)}catch(t){if(!isMicrosandboxNotFoundError$1(t))throw t;return e.metadata.stateSnapshotName===void 0?null:await restoreMicrosandboxSessionSnapshot(e)}if(t.status!==\`running\`&&t.status!==\`draining\`&&e.metadata.stateSnapshotName!==void 0)return await restoreMicrosandboxSessionSnapshot(e);try{let n=t.status===\`running\`||t.status===\`draining\`?await t.connectWithTimeout(5e3):await t.startDetached();await Promise.race([(async()=>{await n.execWith(\`bash\`,b=>b.args([\`-c\`,\`true\`]).cwd(WORKSPACE_ROOT).user(MICROSANDBOX_USER));await n.fs().exists(WORKSPACE_ROOT)})(),new Promise((_,rej)=>setTimeout(()=>rej(new Error(\`Microsandbox probe timed out\`)),4e3))]);return new MicrosandboxVm({module:e.module,options:e.options,sessionKey:e.sessionKey,tags:e.tags},n,e.metadata.sandboxName,e.metadata.networkPolicy,e.metadataPath,e.metadata.optionsHash,e.metadata.stateSnapshotName)}catch(err){console.warn(\`[eve:microsandbox] Stale sandbox \${e.metadata.sandboxName} (\${err?.message}), recreating...\`);await removeSandboxIfExists(e.module,e.metadata.sandboxName).catch(()=>{});return null}}`;

  if (connectRuntimeRegex.test(runtimeCode)) {
    runtimeCode = runtimeCode.replace(connectRuntimeRegex, newConnectRuntime);
    patchedCount++;
    console.log("Patched connectMicrosandbox in node_modules/eve runtime!");
  }

  const runtimeWithRecovery = patchMicrosandboxRecovery(runtimeCode);
  if (runtimeWithRecovery !== runtimeCode) {
    runtimeCode = runtimeWithRecovery;
    patchedCount++;
    console.log("Patched MicrosandboxVm crash recovery in node_modules/eve runtime!");
  }

  fs.writeFileSync(runtimeFile, runtimeCode);
}

// 3. Patch dev-environment.js in node_modules/eve
const devEnvFile = 'node_modules/eve/dist/src/internal/application/dev-environment.js';
if (fs.existsSync(devEnvFile)) {
  let devEnvCode = fs.readFileSync(devEnvFile, 'utf8');
  if (devEnvCode.includes('return process.env[EVE_DEV_ENV_FLAG]===`1`') && !devEnvCode.includes('EVE_PERSIST_SANDBOX')) {
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
