import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Lazy singleton so the client is only created when first used at runtime
// (keeps `next build` working when DATABASE_URL is not yet configured).
const globalForDb = globalThis as unknown as {
  db?: ReturnType<typeof drizzle<typeof schema>>;
};

function createDb() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Add your Neon/Vercel Postgres connection string to .env.",
    );
  }
  const client = postgres(connectionString, { max: 10 });
  return drizzle(client, { schema });
}

export const db = (globalForDb.db ??= createDb());
export * as schema from "./schema";
