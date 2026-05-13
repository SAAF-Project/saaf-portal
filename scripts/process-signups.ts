import { config } from "dotenv";
config({ path: ".env.production.local" });
config({ path: ".env.local" });

import { Client } from "pg";
import { execSync } from "child_process";
import * as readline from "readline";

const isProd = process.argv.includes("--prod");
const connectionString = isProd
  ? process.env.PROD_DATABASE_URL!
  : process.env.DATABASE_URL!;

if (isProd) {
  if (!process.env.PROD_DATABASE_URL) {
    console.error("PROD_DATABASE_URL not set. Add it to .env.production.local");
    process.exit(1);
  }
  console.log("Using PRODUCTION database\n");
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function ask(question: string): Promise<string> {
  return new Promise((resolve) => rl.question(question, resolve));
}

async function main() {
  const db = new Client({ connectionString });
  await db.connect();

  const { rows: pending } = await db.query<{
    id: string; githubUsername: string; email: string | null; createdAt: Date;
  }>(
    `SELECT id, "githubUsername", email, "createdAt" FROM "SignupRequest" WHERE status = 'pending' ORDER BY "createdAt" ASC`
  );

  if (pending.length === 0) {
    console.log("No pending signup requests.");
    rl.close();
    await db.end();
    return;
  }

  console.log(`\n${pending.length} pending signup request(s):\n`);

  for (const req of pending) {
    console.log(`  GitHub: @${req.githubUsername}`);
    if (req.email) console.log(`  Email:  ${req.email}`);
    console.log(`  Date:   ${req.createdAt.toISOString()}`);

    let ghUser = req.githubUsername;
    if (ghUser.includes("@") || ghUser.includes(" ")) {
      const entered = await ask(`  ⚠ "${ghUser}" is not a valid GitHub username. Enter the correct one (or s to skip): `);
      if (!entered.trim() || entered.toLowerCase() === "s") {
        console.log(`  - Skipped.\n`);
        continue;
      }
      ghUser = entered.trim().replace("@", "");
    }

    const answer = await ask("  Action (a=approve, d=deny, s=skip): ");

    if (answer.toLowerCase() === "a") {
      try {
        const idOutput = execSync(`gh api /users/${ghUser} --jq '.id'`, { encoding: "utf-8" }).trim();
        const userId = parseInt(idOutput);
        if (isNaN(userId)) throw new Error(`Could not resolve user ID for ${ghUser}`);

        execSync(
          `gh api /orgs/SAAF-Project/invitations -F invitee_id=${userId} -f role=direct_member`,
          { stdio: "inherit" }
        );
        await db.query(
          `UPDATE "SignupRequest" SET status = 'approved', "processedAt" = NOW() WHERE id = $1`,
          [req.id]
        );
        console.log(`  ✓ Approved and invitation sent to @${ghUser}.\n`);
      } catch (e) {
        console.error(`  ✗ Failed to send invite. Error: ${e}\n`);
      }
    } else if (answer.toLowerCase() === "d") {
      await db.query(
        `UPDATE "SignupRequest" SET status = 'denied', "processedAt" = NOW() WHERE id = $1`,
        [req.id]
      );
      console.log(`  ✗ Denied.\n`);
    } else {
      console.log(`  - Skipped.\n`);
    }
  }

  rl.close();
  await db.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
