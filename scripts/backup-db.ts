import { config } from "dotenv";
config({ path: ".env.production.local" });
config({ path: ".env.local" });

import { Client } from "pg";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";

const isProd = process.argv.includes("--prod");
const connectionString = isProd
  ? process.env.PROD_DATABASE_URL!
  : process.env.DATABASE_URL!;

if (isProd) {
  if (!process.env.PROD_DATABASE_URL) {
    console.error("PROD_DATABASE_URL not set.");
    process.exit(1);
  }
  console.log("Backing up PRODUCTION database\n");
}

const TABLES = ["User", "SignupRequest", "ObservabilityCheck", "Feedback"];
const BACKUP_DIR = join(process.cwd(), "backups");

async function main() {
  if (!existsSync(BACKUP_DIR)) mkdirSync(BACKUP_DIR, { recursive: true });

  const client = new Client({ connectionString });
  await client.connect();

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const env = isProd ? "prod" : "local";
  const filename = `saaf-portal_${env}_${timestamp}.json`;
  const filepath = join(BACKUP_DIR, filename);

  const backup: Record<string, unknown[]> = {
    _metadata: [
      {
        timestamp: new Date().toISOString(),
        environment: env,
        tables: TABLES,
      },
    ],
  };

  for (const table of TABLES) {
    try {
      const { rows } = await client.query(`SELECT * FROM "${table}"`);
      backup[table] = rows;
      console.log(`  ✓ ${table}: ${rows.length} rows`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`  ✗ ${table}: ${msg}`);
      backup[table] = [];
    }
  }

  writeFileSync(filepath, JSON.stringify(backup, null, 2), "utf-8");

  const sizeKB = (Buffer.byteLength(JSON.stringify(backup)) / 1024).toFixed(1);
  console.log(`\n✓ Backup saved: ${filepath}`);
  console.log(`  Size: ${sizeKB} KB`);

  await client.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
