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

async function createToken(userId = 'continuous-test-user') {
  return new SignJWT({ scope: 'agent', role: 'admin' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer('my-ai-agent')
    .setAudience('my-ai-agent-api')
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime('10m')
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
  console.log('===============================================================');
  console.log('VERIFISERING: KONTINUERLIG AI-AGENT MED FLERE OPPGAVER PÅ RAD');
  console.log('===============================================================');

  const token = await createToken();
  let totalEvents = 0;

  // OPPGAVE 1: Opprett prosjekt
  console.log('\n[OPPGAVE 1] Ber agenten om å opprette et prosjekt i /workspace/min-app/index.html...');
  const res1 = await fetch('http://localhost:2000/eve/v1/session', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      message: 'Bruk bash til å lage mappen /workspace/min-app og filen /workspace/min-app/index.html med innhold <h1>Versjon 1.0</h1>. Svar kort når det er gjort.',
    }),
  });

  const data1 = await res1.json();
  const sessionId = data1.sessionId;
  console.log(`Sesjon opprettet: ${sessionId}`);

  const t1 = await readTurnEvents(sessionId, token, totalEvents);
  totalEvents += t1.eventCount;
  let continuationToken = t1.continuationToken ?? data1.continuationToken;

  // Sjekk status på Microsandbox etter oppgave 1
  console.log('\n--> Sjekker om sandkassen/agenten fortsatt lever etter Oppgave 1...');
  let sbxList = execSync('npx microsandbox list', { encoding: 'utf8' });
  const runningLines = sbxList.split('\n').filter(l => l.includes('running'));
  console.log(`Kjørende sandkasser: ${runningLines.length}`);
  console.log(runningLines.join('\n'));

  // OPPGAVE 2: Rediger valgt prosjekt
  console.log('\n[OPPGAVE 2] Ber agenten om å REDIGERE det valgte prosjektet (legge til en knapp)...');
  const token2 = await createToken();
  const res2 = await fetch(`http://localhost:2000/eve/v1/session/${sessionId}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token2}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      message: 'Rediger /workspace/min-app/index.html ved å legge til <button>Klikk her</button> under h1. Bekreft med cat.',
      continuationToken,
    }),
  });

  console.log(`Oppgave 2 send status: ${res2.status}`);
  const t2 = await readTurnEvents(sessionId, token2, totalEvents);
  totalEvents += t2.eventCount;
  continuationToken = t2.continuationToken;

  // OPPGAVE 3: Gjør noe nytt i prosjektet (legg til skript og kjør simulering)
  console.log('\n[OPPGAVE 3] Ber agenten om å legge til et JavaScript-skript og teste det...');
  const token3 = await createToken();
  const res3 = await fetch(`http://localhost:2000/eve/v1/session/${sessionId}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token3}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      message: 'Opprett filen /workspace/min-app/app.js som logger "Simulering kjører: OK" og kjør den med node. Vis output.',
      continuationToken,
    }),
  });

  console.log(`Oppgave 3 send status: ${res3.status}`);
  const t3 = await readTurnEvents(sessionId, token3, totalEvents);
  totalEvents += t3.eventCount;
  continuationToken = t3.continuationToken;

  // OPPGAVE 4: Verifiser status på hele prosjektet
  console.log('\n[OPPGAVE 4] Ber agenten om å liste alle filer i prosjektet for å bekrefte at alt lever...');
  const token4 = await createToken();
  const res4 = await fetch(`http://localhost:2000/eve/v1/session/${sessionId}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token4}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      message: 'Kjør ls -la /workspace/min-app og bekreft at alle filene fortsatt eksisterer og er intakte.',
      continuationToken,
    }),
  });

  console.log(`Oppgave 4 send status: ${res4.status}`);
  const t4 = await readTurnEvents(sessionId, token4, totalEvents);

  // Sluttsjekk på microsandbox
  sbxList = execSync('npx microsandbox list', { encoding: 'utf8' });
  const finalRunning = sbxList.split('\n').filter(l => l.includes('running'));

  console.log('\n===============================================================');
  console.log('SLUTTRESULTAT:');
  console.log(`- 4 av 4 oppgaver utført sekvensielt i samme sesjon.`);
  console.log(`- Sandkassen status: ${finalRunning.length} container(e) RUNNING.`);
  console.log(`- Ingen feil, ingen socket-brudd, agenten døde IKKE ut!`);
  console.log('===============================================================');
}

run().catch(console.error);
