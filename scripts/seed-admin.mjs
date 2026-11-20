import postgres from "../web/node_modules/postgres/src/index.js";
import crypto from "node:crypto";

const dbUrl = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/tech_ai_monkey";
const sql = postgres(dbUrl);

async function run() {
  const userId = crypto.randomUUID();
  const subId = crypto.randomUUID();
  const now = new Date();
  const periodEnd = new Date(now.getTime() + 3650 * 86400000);
  const hash = "$argon2id$v=19$m=65536,t=3,p=1$ZFk+XraCb65ygmeS4jZWzw$SUi/wh85xIYFYXlSTalFfz7NtQdHJ8pXI1QOd8a3qzY";

  await sql`
    INSERT INTO "user" (id, name, email, "passwordHash", role, "createdAt", "updatedAt")
    VALUES (${userId}, 'Hollman Salazar Rivero', 'riveroosx7@gmail.com', ${hash}, 'admin', ${now}, ${now})
    ON CONFLICT (email) DO UPDATE SET role = 'admin', "passwordHash" = ${hash};
  `;

  // Fetch the actual user ID (in case user was already present)
  const [u] = await sql`SELECT id FROM "user" WHERE email = 'riveroosx7@gmail.com' LIMIT 1;`;

  await sql`
    INSERT INTO "subscription" (id, "userId", plan, status, "tokenAllowance", "tokensUsed", "currentPeriodStart", "currentPeriodEnd", "cancelAtPeriodEnd", "createdAt", "updatedAt")
    VALUES (${subId}, ${u.id}, 'bomb', 'active', 999999999, 0, ${now}, ${periodEnd}, false, ${now}, ${now})
    ON CONFLICT DO NOTHING;
  `;

  await sql`
    INSERT INTO "tokenBalance" ("userId", "prepaidTokens", "updatedAt")
    VALUES (${u.id}, 999999999, ${now})
    ON CONFLICT DO NOTHING;
  `;

  console.log("SUCCESS: Admin user riveroosx7@gmail.com registered with role=admin and unlimited tokens!");
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
