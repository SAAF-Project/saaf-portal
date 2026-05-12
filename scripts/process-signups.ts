import { config } from "dotenv";
config({ path: ".env.local" });

import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import { execSync } from "child_process";
import * as readline from "readline";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(question: string): Promise<string> {
  return new Promise((resolve) => rl.question(question, resolve));
}

async function main() {
  const pending = await prisma.signupRequest.findMany({
    where: { status: "pending" },
    orderBy: { createdAt: "asc" },
  });

  if (pending.length === 0) {
    console.log("No pending signup requests.");
    rl.close();
    await prisma.$disconnect();
    return;
  }

  console.log(`\n${pending.length} pending signup request(s):\n`);

  for (const req of pending) {
    console.log(`  GitHub: @${req.githubUsername}`);
    if (req.email) console.log(`  Email:  ${req.email}`);
    console.log(`  Date:   ${req.createdAt.toISOString()}`);

    const answer = await ask("  Action (a=approve, d=deny, s=skip): ");

    if (answer.toLowerCase() === "a") {
      try {
        execSync(
          `gh api /orgs/SAAF-Project/invitations -f invitee_id=$(gh api /users/${req.githubUsername} --jq '.id') -f role=direct_member`,
          { stdio: "inherit" }
        );
        await prisma.signupRequest.update({
          where: { id: req.id },
          data: { status: "approved", processedAt: new Date() },
        });
        console.log(`  ✓ Approved and invitation sent.\n`);
      } catch (e) {
        console.error(`  ✗ Failed to send invite. Error: ${e}\n`);
      }
    } else if (answer.toLowerCase() === "d") {
      await prisma.signupRequest.update({
        where: { id: req.id },
        data: { status: "denied", processedAt: new Date() },
      });
      console.log(`  ✗ Denied.\n`);
    } else {
      console.log(`  - Skipped.\n`);
    }
  }

  rl.close();
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
