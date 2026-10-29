import fs from 'fs';

let patchedCount = 0;

// Creating a fresh Microsandbox VM can hang forever when the host is short on
// memory. Bound it so a turn fails (and can be retried) instead of freezing.
const SANDBOX_HELPER = `async function microsandboxTimeout(p, ms, label) {
\tlet timer;
\ttry {
\t\treturn await Promise.race([p, new Promise((_, rej) => { timer = setTimeout(() => rej(new Error(label)), ms); })]);
\t} finally {
\t\tclearTimeout(timer);
\t}
}
`;

const withSandboxHelper = (text) =>
  text.includes('function microsandboxTimeout(') ? text : SANDBOX_HELPER + text;


// Wrap MicrosandboxVm's native handle so a crashed VM is recovered and the
// failed operation is retried instead of failing the whole turn with
// "[AgentClient] ... Connection refused".
const RECOVERY_HELPERS = `
\t#isStaleSandboxError(e) {
\t\tlet t = String(e && e.message ? e.message : e);
\t\treturn /AgentClient|Connection refused|ECONNREFUSED|os error 111|failed to connect|no such file or directory.*\\.sock|timed out|sandbox.*(not running|crashed|stopped|missing)/i.test(t);
\t}
\tasync #recoverSandbox() {
\t\tconsole.warn(\`[eve:microsandbox] connection lost for \${this.#a}, recovering...\`);
\t\ttry {
\t\t\tlet t = await microsandboxTimeout(this.#e.module.Sandbox.get(this.#a), 3e4, \`Microsandbox lookup timed out\`);
\t\t\tlet n = t.status === \`running\` || t.status === \`draining\` ? await t.connectWithTimeout(5e3) : await microsandboxTimeout(t.startDetached(), 12e4, \`Microsandbox start timed out\`);
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
\t#withCommandTimeout(e) {
\t\tlet ms = Number(process.env.SANDBOX_COMMAND_TIMEOUT_MS ?? 45e3) || 45e3, timer;
\t\treturn Promise.race([e, new Promise((_, rej) => {
\t\t\ttimer = setTimeout(() => rej(new Error(\`sandbox command timed out after \${Math.round(ms / 1e3)}s\`)), ms);
\t\t})]).finally(() => clearTimeout(timer));
\t}
\t#wrapHandle(e) {
\t\tthis.__microsandboxRawHandle = e;
\t\tlet t = this, n = (r) => new Proxy(r, {
\t\t\tget(i, a) {
\t\t\t\tlet o = i[a];
\t\t\t\tif (typeof o !== \`function\`) return o;
\t\t\t\treturn (...s) => {
\t\t\t\t\tlet c = o.apply(i, s);
\t\t\t\t\treturn c && typeof c.catch === \`function\` ? t.#withCommandTimeout(c).catch(async (l) => {
\t\t\t\t\t\tif (!t.#isStaleSandboxError(l)) throw l;
\t\t\t\t\t\tif (!(await t.#recoverSandbox())) throw l;
\t\t\t\t\t\treturn t.#withCommandTimeout(t.__microsandboxRawHandle.fs()[a](...s));
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
\t\t\t\t\treturn s && typeof s.catch === \`function\` ? t.#withCommandTimeout(s).catch(async (c) => {
\t\t\t\t\t\tif (!t.#isStaleSandboxError(c)) throw c;
\t\t\t\t\t\tif (!(await t.#recoverSandbox())) throw c;
\t\t\t\t\t\treturn t.#withCommandTimeout(t.__microsandboxRawHandle[i](...o));
\t\t\t\t\t}) : s;
\t\t\t\t};
\t\t\t}
\t\t});
\t}
`;

// Eldre bygg har recovery-helperen uten tidsgrense på sandkassekommandoer.
// Den oppgraderes på stedet, slik at en VM som slutter å svare blir et
// gjensynlig feilforsøk i stedet for en tur som henger i det uendelige.
// Sandkasse-sesjonen som verktøyene bruker (bash, glob, grep, les/skriv fil) har
// ingen tidsgrense. Blir VM-en stille – typisk når verten er tom for minne –
// venter turen i det uendelige. Her får hvert kall en frist, så verktøyet
// feiler, modellen får beskjed og kan svare i stedet for å henge.
const SANDBOX_TIMEOUT_WRAPPER = `function withSandboxTimeouts(e) {
\tlet ms = Number(process.env.SANDBOX_COMMAND_TIMEOUT_MS ?? 45e3) || 45e3;
\treturn new Proxy(e, {
\t\tget(t, p) {
\t\t\tlet v = t[p];
\t\t\tif (typeof v !== \`function\`) return v;
\t\t\treturn (...a) => {
\t\t\t\tlet r = v.apply(t, a);
\t\t\t\tif (!r || typeof r.then !== \`function\`) return r;
\t\t\t\tlet timer;
\t\t\t\treturn Promise.race([r, new Promise((_, rej) => {
\t\t\t\t\ttimer = setTimeout(() => rej(new Error(\`sandbox \${String(p)} timed out after \${Math.round(ms / 1e3)}s\`)), ms);
\t\t\t\t})]).finally(() => clearTimeout(timer));
\t\t\t};
\t\t}
\t});
}
`;

// Selve gjenopprettingen kunne også henge: den lager en ny VM, og det kallet
// hadde ingen frist. Da ble en tidsavbrutt kommando til en evig venting.
// Selve opprettelsen av en ny sandkasse (før kommandoene i den) hadde heller
// ingen frist. Den er nå bundet, så «opening sandbox session» feiler i stedet
// for å stå og vente til evig tid.
function patchSandboxCreateTimeout(code) {
  if (!code.includes('createBackendHandleWithPrewarmRetry') || code.includes('Sandbox create timed out')) return code;

  let out = code;
  out = out.replace(
    '\t\treturn await e.backend.create(e.createInput);\n\t} catch (t) {',
    '\t\treturn await microsandboxTimeout(e.backend.create(e.createInput), 15e4, `Sandbox create timed out`);\n\t} catch (t) {',
  );
  out = out.replace(
    'logDevelopmentSandbox(`eve: sandbox template is ready; retrying sandbox creation...`), await e.backend.create(e.createInput);',
    'logDevelopmentSandbox(`eve: sandbox template is ready; retrying sandbox creation...`), await microsandboxTimeout(e.backend.create(e.createInput), 15e4, `Sandbox create timed out`);',
  );

  if (out !== code) console.log('La tidsgrense pa oppretting av sandkasse');
  return out;
}

function boundRecoveryCreate(code) {
  if (!code.includes('#recoverSandbox') || code.includes('Microsandbox create timed out')) return code;

  let out = code.replace(
    '\t\t\tlet n = await createMicrosandbox({',
    '\t\t\tlet n = await microsandboxTimeout(createMicrosandbox({',
  );
  out = out.replace(
    '\t\t\t\tworkdir: WORKSPACE_ROOT\n\t\t\t});\n\t\t\tthis.#i = this.#wrapHandle(n);',
    '\t\t\t\tworkdir: WORKSPACE_ROOT\n\t\t\t}), 12e4, `Microsandbox create timed out`);\n\t\t\tthis.#i = this.#wrapHandle(n);',
  );

  if (out !== code) console.log('La tidsgrense på gjenoppretting av sandkasse');
  return out;
}

function patchSandboxTimeouts(code) {
  if (code.includes('withSandboxTimeouts')) return code;
  if (!code.includes('async function requireSandboxSession')) return code;

  let out = code;

  // Framework-verktøyene (bash, glob, grep, read/write file)
  out = out.replace(
    'return t === void 0 ? r : bindSandboxAbortSignal(r, t);',
    'return withSandboxTimeouts(t === void 0 ? r : bindSandboxAbortSignal(r, t));',
  );

  // Forfatterens runtime-kontekst (skills og egne verktøy)
  out = out.replace(
    '\tlet t = await e.get();\n\tif (t === null) throw Error(`The sandbox is not available in the current authored runtime context.`);\n\treturn t;',
    '\tlet t = await e.get();\n\tif (t === null) throw Error(`The sandbox is not available in the current authored runtime context.`);\n\treturn withSandboxTimeouts(t);',
  );

  if (!out.includes('withSandboxTimeouts(')) return code;

  out = out.replace('async function requireSandboxSession', SANDBOX_TIMEOUT_WRAPPER + '\nasync function requireSandboxSession');
  console.log('La tidsgrense på alle sandkassekall');
  return out;
}

function upgradeRecoveryHelpers(code) {
  if (!code.includes('#recoverSandbox') || code.includes('withCommandTimeout')) return code;
  let out = code;

  out = out.replace(
    'failed to connect|no such file or directory',
    'failed to connect|timed out|no such file or directory',
  );

  const helper = `\t#withCommandTimeout(e) {
\t\tlet ms = Number(process.env.SANDBOX_COMMAND_TIMEOUT_MS ?? 45e3) || 45e3, timer;
\t\treturn Promise.race([e, new Promise((_, rej) => {
\t\t\ttimer = setTimeout(() => rej(new Error(\`sandbox command timed out after \${Math.round(ms / 1e3)}s\`)), ms);
\t\t})]).finally(() => clearTimeout(timer));
\t}
\t#wrapHandle(e) {`;
  out = out.replace('\t#wrapHandle(e) {', helper);

  out = out.replace(
    'return c && typeof c.catch === `function` ? c.catch(async (l) => {',
    'return c && typeof c.catch === `function` ? t.#withCommandTimeout(c).catch(async (l) => {',
  );
  out = out.replace(
    'return t.__microsandboxRawHandle.fs()[a](...s);',
    'return t.#withCommandTimeout(t.__microsandboxRawHandle.fs()[a](...s));',
  );
  out = out.replace(
    'return s && typeof s.catch === `function` ? s.catch(async (c) => {',
    'return s && typeof s.catch === `function` ? t.#withCommandTimeout(s).catch(async (c) => {',
  );
  out = out.replace(
    'return t.__microsandboxRawHandle[i](...o);',
    'return t.#withCommandTimeout(t.__microsandboxRawHandle[i](...o));',
  );

  if (out !== code) console.log('Oppgradert recovery-helper med tidsgrense for sandkassekommandoer');
  return out;
}

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

function patchDirectLocalSandbox(code) {
  if (code.includes('createDirectLocalVm')) return code;
  const regex = /async\s+function\s+prewarmMicrosandboxTemplate\s*\(\s*i\s*\)\s*\{[\s\S]*?(?=function\s+createHandle(?:\$\d+)?\s*\()/;
  if (!regex.test(code)) return code;
  const replacement = `async function createDirectLocalVm(appRootInput, sessionKeyInput) {
\tconst fsMod = await import("node:fs/promises");
\tconst pathMod = await import("node:path");
\tconst cpMod = await import("node:child_process");
\tconst appRoot = appRootInput || process.cwd();
\tconst wsRoot = pathMod.join(appRoot, ".eve", "workspaces", "shared");
\tawait fsMod.mkdir(wsRoot, { recursive: true });
\tconst mapPath = (p) => {
\t\tconst clean = String(p || "/workspace").replace(/^\\/workspace\\/?/, "");
\t\tconst resolved = pathMod.resolve(wsRoot, clean);
\t\treturn resolved.startsWith(wsRoot) ? resolved : wsRoot;
\t};
\treturn {
\t\tid: String(sessionKeyInput || "shared"),
\t\tasync setNetworkPolicy() {},
\t\tasync captureState(hash) {
\t\t\treturn {
\t\t\t\tnetworkPolicy: "allow-all",
\t\t\t\toptionsHash: hash,
\t\t\t\tsandboxName: "local-workspace",
\t\t\t\tversion: 2
\t\t\t};
\t\t},
\t\tasync shutdown() {},
\t\tasync readFileBytes(p) {
\t\t\ttry {
\t\t\t\treturn Buffer.from(await fsMod.readFile(mapPath(p)));
\t\t\t} catch {
\t\t\t\treturn null;
\t\t\t}
\t\t},
\t\tasync removePath(opts) {
\t\t\tawait fsMod.rm(mapPath(opts.path), {
\t\t\t\tforce: !!opts.force,
\t\t\t\trecursive: !!opts.recursive
\t\t\t}).catch(() => {});
\t\t},
\t\tasync writeFiles(files) {
\t\t\tfor (const f of files) {
\t\t\t\tconst target = mapPath(f.path);
\t\t\t\tawait fsMod.mkdir(pathMod.dirname(target), { recursive: true });
\t\t\t\tawait fsMod.writeFile(target, f.content);
\t\t\t}
\t\t},
\t\tasync spawn(opts) {
\t\t\tif (opts.abortSignal?.aborted) {
\t\t\t\tthrow new DOMException("The operation was aborted.", "AbortError");
\t\t\t}
\t\t\tconst cwd = opts.workingDirectory ? mapPath(opts.workingDirectory) : wsRoot;
\t\t\tawait fsMod.mkdir(cwd, { recursive: true }).catch(() => {});
\t\t\tconst child = cpMod.spawn("bash", ["-lc", opts.command], {
\t\t\t\tcwd,
\t\t\t\tenv: { ...process.env, ...opts.env, HOME: wsRoot }
\t\t\t});
\t\t\tlet outCtrl, errCtrl, resolveExit;
\t\t\tconst exitPromise = new Promise((r) => { resolveExit = r; });
\t\t\tconst stdout = new ReadableStream({ start(c) { outCtrl = c; } });
\t\t\tconst stderr = new ReadableStream({ start(c) { errCtrl = c; } });
\t\t\tchild.stdout.on("data", (d) => { try { outCtrl.enqueue(new Uint8Array(d)); } catch {} });
\t\t\tchild.stderr.on("data", (d) => { try { errCtrl.enqueue(new Uint8Array(d)); } catch {} });
\t\t\tchild.on("close", (code) => {
\t\t\t\ttry { outCtrl.close(); } catch {}
\t\t\t\ttry { errCtrl.close(); } catch {}
\t\t\t\tresolveExit(code ?? 0);
\t\t\t});
\t\t\tchild.on("error", () => {
\t\t\t\ttry { outCtrl.close(); } catch {}
\t\t\t\ttry { errCtrl.close(); } catch {}
\t\t\t\tresolveExit(1);
\t\t\t});
\t\t\tif (opts.abortSignal) {
\t\t\t\topts.abortSignal.addEventListener("abort", () => { child.kill("SIGKILL"); }, { once: true });
\t\t\t}
\t\t\treturn {
\t\t\t\tstdout,
\t\t\t\tstderr,
\t\t\t\tasync wait() {
\t\t\t\t\tconst exitCode = await exitPromise;
\t\t\t\t\treturn { exitCode };
\t\t\t\t},
\t\t\t\tasync kill() {
\t\t\t\t\tchild.kill("SIGKILL");
\t\t\t\t}
\t\t\t};
\t\t}
\t};
}
async function prewarmMicrosandboxTemplate(i) {
\tconst vm = await createDirectLocalVm(i?.prewarmInput?.runtimeContext?.appRoot, "shared");
\tconst session = buildSandboxSession(createMicrosandboxInternalSession(vm), async () => {});
\tif (i?.prewarmInput?.seedFiles?.length > 0) {
\t\tawait writeSandboxSeedFiles(session, i.prewarmInput.seedFiles);
\t}
\treturn { reused: !0 };
}
async function createMicrosandboxHandle(e) {
\tconst sessionKey = String(e?.createInput?.sessionKey ?? "shared");
\tconst vm = await createDirectLocalVm(e?.createInput?.runtimeContext?.appRoot, sessionKey);
\treturn createHandle(vm, e.backendName, e.optionsHash, () => {});
}
`;
  const out = code.replace(regex, replacement);
  if (out !== code) console.log('Aktivert direkte lokal sandkasse (0 ms oppstart, 0 VM RAM, fryser aldri)');
  return out;
}

function patchWarmSharedSandbox(code) {
  if (code.includes('eve-sbx-shared-warm')) return code;
  const regex = /async\s+function\s+createPreparedMicrosandbox\s*\(\s*e\s*\)\s*\{/;
  if (!regex.test(code)) return code;
  const replacement = `async function createPreparedMicrosandbox(e) {
\tlet warmName = "eve-sbx-shared-warm";
\ttry {
\t\tconst fsMod = await import("node:fs");
\t\tif (fsMod.existsSync(".eve/warm-sandbox-name")) {
\t\t\tconst saved = fsMod.readFileSync(".eve/warm-sandbox-name", "utf8").trim();
\t\t\tif (saved) warmName = saved;
\t\t}
\t\tlet sbx = await microsandboxTimeout(e.module.Sandbox.get(warmName), 5e3, "Warm lookup timeout");
\t\tif (sbx && (sbx.status === "running" || sbx.status === "draining")) {
\t\t\tlet h = await sbx.connectWithTimeout(5e3);
\t\t\treturn new MicrosandboxVm({ module: e.module, options: e.options, sessionKey: e.sessionKey, tags: e.tags }, h, warmName, e.networkPolicy);
\t\t}
\t} catch {}
\te = { ...e, name: warmName };`;
  const out = code.replace(regex, replacement);
  if (out !== code) console.log('Aktivert gjenbruk av varm delt sandkasse (eve-sbx-shared-warm)');
  return out;
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
\t\tt = await microsandboxTimeout(e.module.Sandbox.get(e.metadata.sandboxName), 3e4, \`Microsandbox lookup timed out\`);
\t} catch (t) {
\t\tif (!isMicrosandboxNotFoundError(t)) throw t;
\t\treturn e.metadata.stateSnapshotName === void 0 ? null : await restoreMicrosandboxSessionSnapshot(e);
\t}
\tif (t.status !== \`running\` && t.status !== \`draining\` && e.metadata.stateSnapshotName !== void 0) return await restoreMicrosandboxSessionSnapshot(e);
\ttry {
\t\tlet n = t.status === \`running\` || t.status === \`draining\` ? await t.connectWithTimeout(5e3) : await microsandboxTimeout(t.startDetached(), 12e4, \`Microsandbox start timed out\`);
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

  fs.writeFileSync(
    bundleFile,
    patchDirectLocalSandbox(
      patchWarmSharedSandbox(
        patchSandboxCreateTimeout(
          boundRecoveryCreate(patchSandboxTimeouts(withSandboxHelper(upgradeRecoveryHelpers(code)))),
        ),
      ),
    ),
  );
}

const lifecycleFile = 'node_modules/eve/dist/src/execution/sandbox/bindings/microsandbox-lifecycle.js';
if (fs.existsSync(lifecycleFile)) {
  const lcCode = fs.readFileSync(lifecycleFile, 'utf8');
  const patchedLc = patchDirectLocalSandbox(lcCode);
  if (patchedLc !== lcCode) {
    fs.writeFileSync(lifecycleFile, patchedLc);
    patchedCount++;
  }
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

  const newConnectRuntime = `async function connectMicrosandbox(e){let t;try{t=await microsandboxTimeout(e.module.Sandbox.get(e.metadata.sandboxName),3e4,\`Microsandbox lookup timed out\`)}catch(t){if(!isMicrosandboxNotFoundError$1(t))throw t;return e.metadata.stateSnapshotName===void 0?null:await restoreMicrosandboxSessionSnapshot(e)}if(t.status!==\`running\`&&t.status!==\`draining\`&&e.metadata.stateSnapshotName!==void 0)return await restoreMicrosandboxSessionSnapshot(e);try{let n=t.status===\`running\`||t.status===\`draining\`?await t.connectWithTimeout(5e3):await microsandboxTimeout(t.startDetached(),12e4,\`Microsandbox start timed out\`);await Promise.race([(async()=>{await n.execWith(\`bash\`,b=>b.args([\`-c\`,\`true\`]).cwd(WORKSPACE_ROOT).user(MICROSANDBOX_USER));await n.fs().exists(WORKSPACE_ROOT)})(),new Promise((_,rej)=>setTimeout(()=>rej(new Error(\`Microsandbox probe timed out\`)),4e3))]);return new MicrosandboxVm({module:e.module,options:e.options,sessionKey:e.sessionKey,tags:e.tags},n,e.metadata.sandboxName,e.metadata.networkPolicy,e.metadataPath,e.metadata.optionsHash,e.metadata.stateSnapshotName)}catch(err){console.warn(\`[eve:microsandbox] Stale sandbox \${e.metadata.sandboxName} (\${err?.message}), recreating...\`);await removeSandboxIfExists(e.module,e.metadata.sandboxName).catch(()=>{});return null}}`;

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

  fs.writeFileSync(runtimeFile, patchWarmSharedSandbox(withSandboxHelper(upgradeRecoveryHelpers(runtimeCode))));
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
