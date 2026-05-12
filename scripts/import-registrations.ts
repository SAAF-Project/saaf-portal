import { config } from "dotenv";
config({ path: ".env.local" });

import { Octokit } from "@octokit/rest";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import { matchCompanyLogo } from "../src/lib/logo-match.js";

const octokit = new Octokit({ auth: process.env.GITHUB_PAT });
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

function parseRegistration(issue: {
  number: number;
  title: string;
  body: string | null;
  user: { login: string } | null;
}) {
  const body = issue.body || "";

  const get = (...labels: string[]): string => {
    for (const label of labels) {
      const esc = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      let m = body.match(new RegExp(`\\*\\*${esc}:\\*\\*\\s*(.+)`));
      if (m) return m[1].trim();
      m = body.match(new RegExp(`###\\s*${esc}[^\\n]*\\n+([^\\n#]+)`, "i"));
      if (m) return m[1].trim();
    }
    return "";
  };

  const getSkill = (label: string): number => {
    const m = body.match(new RegExp(`${label}\\s*\\|\\s*(\\d)`));
    return m ? parseInt(m[1]) : 3;
  };

  let subtrack: string | null = null;
  const tm =
    body.match(/\*\*Preferred Track:\*\*\s*(?:Track\s*)?(\d+[ab]?)/i) ||
    body.match(/###\s*Preferred Track[^\n]*\n+\s*(?:Track\s*)?(\d+[ab]?)/i);
  if (tm) subtrack = tm[1].toLowerCase();

  const rawRole = get("Role").replace(/^\(role\)\s*/i, "").trim();

  return {
    name:
      get("Name") ||
      issue.title.replace(/Register:\s*/, "").replace(/\s*—.*/, ""),
    github:
      get("GitHub", "GitHub username").replace("@", "") ||
      issue.user?.login ||
      "",
    org: get("Organisation"),
    role: rawRole,
    subtrack,
    skills: {
      prompts: getSkill("Prompts"),
      tools: getSkill("Tools"),
      regulatory: getSkill("Regulatory"),
      outputs: getSkill("Outputs"),
    },
    issueNum: issue.number,
  };
}

async function resolveGithubId(
  username: string
): Promise<number | null> {
  try {
    const { data } = await octokit.rest.users.getByUsername({
      username,
    });
    return data.id;
  } catch {
    return null;
  }
}

async function main() {
  console.log("Fetching registration issues...");

  const issues = await octokit.paginate(
    octokit.rest.issues.listForRepo,
    {
      owner: "SAAF-Project",
      repo: "SAAF-Project",
      labels: "register",
      state: "all",
      per_page: 100,
    }
  );

  console.log(`Found ${issues.length} registration issues`);

  let imported = 0;
  let failed = 0;
  const failures: string[] = [];

  for (const issue of issues) {
    const reg = parseRegistration({
      number: issue.number,
      title: issue.title,
      body: issue.body || null,
      user: issue.user ? { login: issue.user.login } : null,
    });

    if (!reg.github) {
      failures.push(`#${issue.number}: No GitHub username found`);
      failed++;
      continue;
    }

    const githubId = await resolveGithubId(reg.github);
    if (!githubId) {
      failures.push(
        `#${issue.number}: Could not resolve GitHub user "${reg.github}"`
      );
      failed++;
      continue;
    }

    const logo = matchCompanyLogo(reg.org);

    try {
      await prisma.user.upsert({
        where: { githubId },
        update: {
          name: reg.name || undefined,
          organisation: reg.org || undefined,
          role: reg.role || undefined,
          preferredTrack: reg.subtrack || undefined,
          skillPrompts: reg.skills.prompts,
          skillTools: reg.skills.tools,
          skillRegulatory: reg.skills.regulatory,
          skillOutputs: reg.skills.outputs,
          registrationIssue: reg.issueNum,
          ...(logo ? { companyLogoUrl: logo, showLogoOnWebsite: true } : {}),
        },
        create: {
          githubId,
          githubUsername: reg.github,
          name: reg.name,
          organisation: reg.org,
          role: reg.role,
          preferredTrack: reg.subtrack,
          skillPrompts: reg.skills.prompts,
          skillTools: reg.skills.tools,
          skillRegulatory: reg.skills.regulatory,
          skillOutputs: reg.skills.outputs,
          registrationIssue: reg.issueNum,
          avatarUrl: `https://github.com/${reg.github}.png`,
          ...(logo ? { companyLogoUrl: logo, showLogoOnWebsite: true } : {}),
        },
      });
      imported++;
      console.log(
        `  ✓ #${issue.number}: ${reg.name} (@${reg.github}) → ${reg.subtrack || "no track"}`
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      failures.push(`#${issue.number}: DB error: ${msg}`);
      failed++;
    }
  }

  console.log("\n--- Summary ---");
  console.log(`Imported: ${imported}`);
  console.log(`Failed: ${failed}`);
  if (failures.length > 0) {
    console.log("\nFailures:");
    failures.forEach((f) => console.log(`  ✗ ${f}`));
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
