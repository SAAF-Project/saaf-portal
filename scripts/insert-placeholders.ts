import { config } from "dotenv";
config({ path: ".env.production.local" });
config({ path: ".env.local" });

import { Octokit } from "@octokit/rest";
import { Client } from "pg";
import { matchCompanyLogo } from "../src/lib/logo-match.js";

const octokit = new Octokit({ auth: process.env.GITHUB_PAT });

function parseRegistration(issue: { number: number; title: string; body: string | null; user: { login: string } | null }) {
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
  const tm = body.match(/\*\*Preferred Track:\*\*\s*(?:Track\s*)?(\d+[ab]?)/i) ||
    body.match(/###\s*Preferred Track[^\n]*\n+\s*(?:Track\s*)?(\d+[ab]?)/i);
  if (tm) subtrack = tm[1].toLowerCase();
  const rawRole = get("Role").replace(/^\(role\)\s*/i, "").trim();
  return {
    name: get("Name") || issue.title.replace(/Register:\s*/, "").replace(/\s*—.*/, ""),
    github: get("GitHub", "GitHub username").replace("@", "") || issue.user?.login || "",
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

function isValidGithubUsername(s: string): boolean {
  return /^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/.test(s);
}

async function main() {
  const client = new Client({ connectionString: process.env.PROD_DATABASE_URL });
  await client.connect();

  const issues = await octokit.paginate(octokit.rest.issues.listForRepo, {
    owner: "SAAF-Project", repo: "SAAF-Project", labels: "register", state: "all", per_page: 100,
  });

  let inserted = 0;
  let skipped = 0;

  for (const issue of issues) {
    const reg = parseRegistration({
      number: issue.number,
      title: issue.title,
      body: issue.body || null,
      user: issue.user ? { login: issue.user.login } : null,
    });

    if (reg.github && isValidGithubUsername(reg.github)) {
      skipped++;
      continue; // already handled by regular import
    }

    const placeholderId = -(issue.number);
    const placeholderUsername = `_placeholder_${issue.number}`;
    const logo = matchCompanyLogo(reg.org);
    const now = new Date().toISOString();

    await client.query(
      `INSERT INTO "User" ("id", "githubId", "githubUsername", "name", "organisation", "role",
       "preferredTrack", "skillPrompts", "skillTools", "skillRegulatory", "skillOutputs",
       "showLogoOnWebsite", "registrationIssue", "createdAt", "updatedAt"
       ${logo ? `, "companyLogoUrl"` : ""})
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $13
       ${logo ? ", $14" : ""})
       ON CONFLICT ("githubId") DO UPDATE SET
         "name" = EXCLUDED."name",
         "organisation" = EXCLUDED."organisation",
         "role" = EXCLUDED."role",
         "preferredTrack" = EXCLUDED."preferredTrack",
         "updatedAt" = EXCLUDED."updatedAt"`,
      logo
        ? [placeholderId, placeholderUsername, reg.name, reg.org, reg.role, reg.subtrack,
           reg.skills.prompts, reg.skills.tools, reg.skills.regulatory, reg.skills.outputs,
           logo ? true : false, issue.number, now, logo]
        : [placeholderId, placeholderUsername, reg.name, reg.org, reg.role, reg.subtrack,
           reg.skills.prompts, reg.skills.tools, reg.skills.regulatory, reg.skills.outputs,
           false, issue.number, now]
    );

    console.log(`  ✓ #${issue.number}: ${reg.name} (placeholder) → ${reg.subtrack || "no track"}`);
    inserted++;
  }

  const count = await client.query('SELECT COUNT(*) FROM "User"');
  console.log(`\nInserted: ${inserted}, Skipped (valid GitHub): ${skipped}`);
  console.log(`Total users in DB: ${count.rows[0].count}`);
  await client.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
