import fs from 'fs';
import { SignJWT } from 'jose';
import { execSync } from 'child_process';

const envLines = fs.readFileSync('.env', 'utf8').split('\n');
const env = {};
for (const line of envLines) {
  if (line && !line.startsWith('#') && line.includes('=')) {
    const idx = line.indexOf('=');
    env[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
}

const REAL_USER_ID = 'c0199a5d-7187-49b0-810f-3d3545a78a9a';

async function createToken(userId = REAL_USER_ID) {
  return new SignJWT({ scope: 'agent', role: 'admin' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer('my-ai-agent')
    .setAudience('my-ai-agent-api')
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime('20m')
    .sign(new TextEncoder().encode(env.AGENT_API_KEY_SECRET));
}

async function readTurnEvents(sessionId, token, startIndex = 0) {
  const url = `http://localhost:2000/eve/v1/session/${sessionId}/stream${
    startIndex > 0 ? `?startIndex=${startIndex}` : ''
  }`;
  const streamRes = await fetch(url, {
    headers: { authorization: `Bearer ${token}` },
  });

  const reader = streamRes.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  let continuationToken = null;
  let fullText = '';
  let eventCount = 0;

  readLoop: while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.trim()) continue;
      eventCount++;
      try {
        const ev = JSON.parse(line);
        if (ev.type === 'message.appended') {
          const delta = ev.data?.messageDelta || '';
          fullText += delta;
          process.stdout.write(delta);
        } else if (ev.type === 'message.completed') {
          if (ev.data?.message) fullText = ev.data.message;
        } else if (ev.type === 'tool.started') {
          process.stdout.write(`\n  [VERKTØY STARTET: ${ev.data?.toolName || 'tool'}]\n`);
        } else if (ev.type === 'session.waiting' || ev.type === 'turn.completed') {
          if (ev.data?.continuationToken) continuationToken = ev.data.continuationToken;
          if (ev.type === 'session.waiting') {
            await reader.cancel();
            break readLoop;
          }
        }
      } catch {}
    }
  }
  return { continuationToken, fullText, eventCount };
}

async function run() {
  console.log('====================================================================');
  console.log(' TECH AI MONKEY v2.0.0 (TECH-AI.TECH MONKEY V2.0 / QWEN 3.8 HYBRID CORE)');
  console.log(' MULTITASK- & MULTIPROSJEKT-TEST I VIRTUELL MASKIN (5 OPPGAVER)');
  console.log('====================================================================');

  const token1 = await createToken();
  let totalEvents = 0;

  // OPPGAVE 1: Prosjekt 1 - Kryssplattform System- & Prosess-verktøy (macOS + Linux)
  console.log('\n--------------------------------------------------------------------');
  console.log('[OPPGAVE 1/5] Prosjekt 1: Kryssplattform macOS/Linux Prosess-diagnose');
  console.log('--------------------------------------------------------------------');
  const res1 = await fetch('http://localhost:2000/eve/v1/session', {
    method: 'POST',
    headers: { authorization: `Bearer ${token1}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      message:
        'Opprett prosjektmappen /workspace/prosjekt1_sysdiag og lag et kryssplattform bash-skript /workspace/prosjekt1_sysdiag/sysdiag.sh som bruker export LC_ALL=C og sjekker uname -s (støtter både Darwin/macOS og Linux) for å vise de 3 prosessene som bruker mest minne. Kjør skriptet og vis output kort.',
    }),
  });

  if (!res1.ok) {
    throw new Error(`Kunne ikke opprette sesjon: ${res1.status} ${await res1.text()}`);
  }

  const data1 = await res1.json();
  const sessionId = data1.sessionId;
  console.log(`Sesjon opprettet: ${sessionId}`);

  const t1 = await readTurnEvents(sessionId, token1, totalEvents);
  totalEvents += t1.eventCount;
  let continuationToken = t1.continuationToken ?? data1.continuationToken;

  // OPPGAVE 2: Bytt til Prosjekt 2 - Python Data- & Logganalyse-motor
  console.log('\n\n--------------------------------------------------------------------');
  console.log('[OPPGAVE 2/5] Bytt til Prosjekt 2: Python Data- & Logganalyse-motor');
  console.log('--------------------------------------------------------------------');
  const token2 = await createToken();
  const res2 = await fetch(`http://localhost:2000/eve/v1/session/${sessionId}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token2}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      message:
        'Nå bytter vi til et nytt prosjekt i /workspace/prosjekt2_data_engine. Lag et Python-skript /workspace/prosjekt2_data_engine/analyze.py som analyserer en liste med server-responstider ([12, 18, 25, 42, 110, 15, 19] ms) på tvers av macOS, Linux og Windows, lagrer min/max/snitt til /workspace/prosjekt2_data_engine/stats.json og skriver ut JSON-innholdet. Kjør det med python3.',
      continuationToken,
    }),
  });
  console.log(`Oppgave 2 HTTP status: ${res2.status}`);
  const t2 = await readTurnEvents(sessionId, token2, totalEvents);
  totalEvents += t2.eventCount;
  continuationToken = t2.continuationToken ?? continuationToken;

  // OPPGAVE 3: Bytt til Prosjekt 3 - Node.js Kryssplattform Modul + Enhetstester
  console.log('\n\n--------------------------------------------------------------------');
  console.log('[OPPGAVE 3/5] Bytt til Prosjekt 3: Node.js Kryssplattform App & Tester');
  console.log('--------------------------------------------------------------------');
  const token3 = await createToken();
  const res3 = await fetch(`http://localhost:2000/eve/v1/session/${sessionId}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token3}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      message:
        'Nå bytter vi til et tredje prosjekt i /workspace/prosjekt3_node_app. Lag /workspace/prosjekt3_node_app/platform_info.mjs som bruker node:os og node:path for å eksportere en funksjon getPlatformSummary(), og lag /workspace/prosjekt3_node_app/test.mjs som tester funksjonen og skriver "ALLE TESTER BESTÅTT". Kjør node /workspace/prosjekt3_node_app/test.mjs.',
      continuationToken,
    }),
  });
  console.log(`Oppgave 3 HTTP status: ${res3.status}`);
  const t3 = await readTurnEvents(sessionId, token3, totalEvents);
  totalEvents += t3.eventCount;
  continuationToken = t3.continuationToken ?? continuationToken;

  // OPPGAVE 4: Bytt tilbake til Prosjekt 1 og utvid det med --json modus
  console.log('\n\n--------------------------------------------------------------------');
  console.log('[OPPGAVE 4/5] Bytt tilbake til Prosjekt 1 & legg til --json flagg');
  console.log('--------------------------------------------------------------------');
  const token4 = await createToken();
  const res4 = await fetch(`http://localhost:2000/eve/v1/session/${sessionId}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token4}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      message:
        'Gå tilbake til /workspace/prosjekt1_sysdiag/sysdiag.sh og utvid det slik at hvis man kjører det med --json så skriver det ut {"status":"ok","os":"..."} som gyldig JSON. Test det ved å kjøre bash /workspace/prosjekt1_sysdiag/sysdiag.sh --json.',
      continuationToken,
    }),
  });
  console.log(`Oppgave 4 HTTP status: ${res4.status}`);
  const t4 = await readTurnEvents(sessionId, token4, totalEvents);
  totalEvents += t4.eventCount;
  continuationToken = t4.continuationToken ?? continuationToken;

  // OPPGAVE 5: Lagre Prosjekt 3 som Artifact til Dashboard og bekreft alle 3 prosjekter
  console.log('\n\n--------------------------------------------------------------------');
  console.log('[OPPGAVE 5/5] Lagre prosjekt med save_artifact & verifiser alle 3 prosjekter');
  console.log('--------------------------------------------------------------------');
  const token5 = await createToken();
  const res5 = await fetch(`http://localhost:2000/eve/v1/session/${sessionId}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token5}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      message:
        'Bruk nå verktøyet save_artifact med title "Node Kryssplattform App v2.0.0", description "Kryssplattform Node.js-modul testet i VM", projectType "script" og directory "/workspace/prosjekt3_node_app". Gi deretter en kort bekreftelse på at alle 3 prosjektene (/workspace/prosjekt1_sysdiag, /workspace/prosjekt2_data_engine, /workspace/prosjekt3_node_app) er ferdige.',
      continuationToken,
    }),
  });
  console.log(`Oppgave 5 HTTP status: ${res5.status}`);
  const t5 = await readTurnEvents(sessionId, token5, totalEvents);
  totalEvents += t5.eventCount;

  const sbxList = execSync('npx microsandbox list', { encoding: 'utf8' });
  const finalRunning = sbxList.split('\n').filter((l) => l.includes('running'));

  console.log('\n\n====================================================================');
  console.log(' SLUTTRESULTAT FOR MULTITASK-TEST (5 FORSKJELLIGE OPPGAVER):');
  console.log(` - Sesjon: ${sessionId}`);
  console.log(` - Totalt antall strømme-events lest sømløst: ${totalEvents}`);
  console.log(` - Kjørende Microsandbox VM-er: ${finalRunning.length}`);
  console.log(' - Alle 5 oppgaver + prosjektbytter + save_artifact fullført uten heng!');
  console.log('====================================================================');
}

run().catch((err) => {
  console.error('Feil under multitask-test:', err);
  process.exit(1);
});
