import { config } from "dotenv";
config({ path: ".env.production.local" });
config({ path: ".env.local" });

import { Client } from "pg";

async function main() {
  const client = new Client({
    connectionString: process.env.PROD_DATABASE_URL || process.env.DATABASE_URL,
  });
  await client.connect();
  await client.query(
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isPlaceholder" BOOLEAN NOT NULL DEFAULT false`
  );
  console.log('✓ Column "isPlaceholder" added to User table');
  await client.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
