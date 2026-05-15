import { config } from "dotenv";
config({ path: ".env.production.local" });
config({ path: ".env.local" });

import { Client } from "pg";
import { matchCompanyLogo } from "../src/lib/logo-match.js";

const isProd = process.argv.includes("--prod");
const connectionString = isProd
  ? process.env.PROD_DATABASE_URL!
  : process.env.DATABASE_URL!;

if (isProd) {
  if (!process.env.PROD_DATABASE_URL) {
    console.error("PROD_DATABASE_URL not set.");
    process.exit(1);
  }
  console.log("Using PRODUCTION database\n");
}

interface UserRow {
  id: string;
  githubUsername: string;
  organisation: string | null;
  companyLogoUrl: string | null;
  showLogoOnWebsite: boolean;
}

async function main() {
  const c = new Client({ connectionString });
  await c.connect();

  const { rows } = await c.query<UserRow>(
    `SELECT id, "githubUsername", organisation, "companyLogoUrl", "showLogoOnWebsite" FROM "User"`
  );

  let cleared = 0;
  let updated = 0;
  let unchanged = 0;
  const changes: Array<{ user: string; org: string; oldLogo: string | null; newLogo: string | null }> = [];

  for (const u of rows) {
    const correctLogo = matchCompanyLogo(u.organisation);
    const currentLogo = u.companyLogoUrl;

    if (currentLogo === correctLogo) {
      unchanged++;
      continue;
    }

    // If correct match is null but user has a logo from auto-match (saafproject.com URL),
    // they got it from the buggy match — clear it.
    // If correct match exists and differs, update.
    // Don't clear manually-set logos that aren't from saafproject.com.
    const isAutoMatched = currentLogo?.startsWith("https://saafproject.com/assets/logos/") ?? false;

    if (!isAutoMatched && correctLogo === null) {
      // User has a custom logo URL (not from auto-match) — leave it alone
      unchanged++;
      continue;
    }

    if (correctLogo === null) {
      await c.query(
        `UPDATE "User" SET "companyLogoUrl" = NULL, "showLogoOnWebsite" = false WHERE id = $1`,
        [u.id]
      );
      changes.push({
        user: `${u.githubUsername} (${u.organisation || "no org"})`,
        org: u.organisation || "",
        oldLogo: currentLogo,
        newLogo: null,
      });
      cleared++;
    } else {
      await c.query(
        `UPDATE "User" SET "companyLogoUrl" = $1, "showLogoOnWebsite" = true WHERE id = $2`,
        [correctLogo, u.id]
      );
      changes.push({
        user: `${u.githubUsername} (${u.organisation || "no org"})`,
        org: u.organisation || "",
        oldLogo: currentLogo,
        newLogo: correctLogo,
      });
      updated++;
    }
  }

  console.log(`\n--- Summary ---`);
  console.log(`Total users:     ${rows.length}`);
  console.log(`Logo cleared:    ${cleared}`);
  console.log(`Logo updated:    ${updated}`);
  console.log(`Unchanged:       ${unchanged}`);

  if (changes.length > 0) {
    console.log(`\n--- Changes ---`);
    for (const ch of changes) {
      const oldName = ch.oldLogo?.split("/").pop() ?? "—";
      const newName = ch.newLogo?.split("/").pop() ?? "—";
      console.log(`  ${ch.user}: ${oldName} → ${newName}`);
    }
  }

  await c.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
