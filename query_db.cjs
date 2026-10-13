const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://tech_ai_monkey:9d13624c1e68316417062e4c9c52dcba5293e86126452df0@127.0.0.1:5432/tech_ai_monkey'
});
async function run() {
  await client.connect();
  const res = await client.query('SELECT id, "createdAt" FROM session ORDER BY "createdAt" DESC LIMIT 5;');
  console.log("Sessions:", res.rows);
  const msg = await client.query('SELECT "sessionId", content, "createdAt" FROM messages ORDER BY "createdAt" DESC LIMIT 5;');
  console.log("Latest Messages:", msg.rows.map(r => ({ ...r, content: r.content.substring(0, 50) })));
  await client.end();
}
run().catch(console.error);
