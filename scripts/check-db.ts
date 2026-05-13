import { config } from "dotenv";
config({ path: ".env.production.local" });
config({ path: ".env.local" });

import { Client } from "pg";

async function main() {
  const c = new Client({ connectionString: process.env.PROD_DATABASE_URL });
  await c.connect();

  const total = await c.query('SELECT COUNT(*) FROM "User"');
  console.log("Total users:", total.rows[0].count);

  const placeholders = await c.query('SELECT COUNT(*) FROM "User" WHERE "githubId" < 0');
  console.log("Placeholder users (githubId < 0):", placeholders.rows[0].count);

  const sample = await c.query('SELECT "githubId", "githubUsername", "name" FROM "User" WHERE "githubId" < 0 LIMIT 5');
  console.log("Sample placeholders:", sample.rows);

  await c.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
