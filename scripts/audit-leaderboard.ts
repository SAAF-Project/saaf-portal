import { config } from "dotenv";
config({ path: ".env.production.local" });
config({ path: ".env.local" });

import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";

const GITHUB_PAT = process.env.GITHUB_PAT!;
const REPO = "SAAF-Project/SAAF-Project";
const API = "https://api.github.com";

// === Scoring constants (mirrors src/lib/scoring.ts) ===
const LIMITS = { maxPRs: 5, maxNewPlans: 3, maxClaims: 2 };
const SESSION_DATES: Record<string, string> = {
  all: "1970-01-01T00:00:00Z",
  h3: "2026-04-21T00:00:00Z",
  h2: "2026-03-24T00:00:00Z",
};

function isPlanFile(filename: string): boolean {
  return /^plans\/.*\.md$/.test(filename) && !filename.endsWith("README.md");
}

async function ghFetch(url: string) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${GITHUB_PAT}`, Accept: "application/vnd.github+json" },
  });
  if (!res.ok) throw new Error(`GitHub API ${res.status}: ${url}`);
  return res.json();
}

interface PRFile { filename: string; status: string; }
interface PR { number: number; title: string; merged_at: string; user: { login: string }; html_url: string; }
interface PRRecord extends PR { files: PRFile[]; }

async function fetchAllMergedPRs(): Promise<PRRecord[]> {
  const allPRs: PRRecord[] = [];
  let page = 1;
  process.stderr.write("Fetching PRs");

  while (true) {
    const prs: PR[] = await ghFetch(`${API}/repos/${REPO}/pulls?state=closed&per_page=100&page=${page}`);
    if (!Array.isArray(prs) || prs.length === 0) break;

    const merged = prs.filter((pr) => pr.merged_at);
    process.stderr.write(`.`);

    const withFiles = await Promise.all(
      merged.map(async (pr) => {
        const files: PRFile[] = await ghFetch(`${API}/repos/${REPO}/pulls/${pr.number}/files`);
        return { ...pr, files };
      })
    );
    allPRs.push(...withFiles);

    if (prs.length < 100 || page > 50) break;
    page++;
  }
  process.stderr.write(` ${allPRs.length} merged PRs\n`);
  return allPRs;
}

function computeScores(prs: PRRecord[], sinceDate: string) {
  const scores: Record<string, {
    prs: number; prPts: number; prList: { num: number; title: string; date: string }[];
    newPlans: number; newPlanPts: number; newPlanFiles: string[];
    updates: Set<string>; updatePts: number; updateFiles: string[];
    claims: number; claimPts: number;
    total: number;
    skippedPRs: { num: number; reason: string }[];
    skippedFiles: { file: string; status: string; reason: string; pr: number }[];
  }> = {};

  const ensure = (login: string) => {
    if (!scores[login]) {
      scores[login] = {
        prs: 0, prPts: 0, prList: [],
        newPlans: 0, newPlanPts: 0, newPlanFiles: [],
        updates: new Set(), updatePts: 0, updateFiles: [],
        claims: 0, claimPts: 0,
        total: 0,
        skippedPRs: [],
        skippedFiles: [],
      };
    }
    return scores[login];
  };

  for (const pr of prs) {
    if (pr.merged_at < sinceDate) continue;
    const login = pr.user.login;
    const s = ensure(login);

    if (s.prs < LIMITS.maxPRs) {
      s.prs++;
      s.prPts += 10;
      s.total += 10;
      s.prList.push({ num: pr.number, title: pr.title, date: pr.merged_at.slice(0, 10) });
    } else {
      s.skippedPRs.push({ num: pr.number, reason: `PR cap reached (${LIMITS.maxPRs})` });
    }

    for (const f of pr.files) {
      if (!isPlanFile(f.filename)) {
        if (f.filename.endsWith(".md")) {
          s.skippedFiles.push({ file: f.filename, status: f.status, reason: "Not in plans/ directory", pr: pr.number });
        }
        continue;
      }

      if (f.status === "added") {
        if (s.newPlans < LIMITS.maxNewPlans) {
          s.newPlans++;
          s.newPlanPts += 15;
          s.total += 15;
          s.newPlanFiles.push(f.filename);
        } else {
          s.skippedFiles.push({ file: f.filename, status: f.status, reason: `New plan cap reached (${LIMITS.maxNewPlans})`, pr: pr.number });
        }
      } else if (f.status === "modified") {
        if (!s.updates.has(f.filename)) {
          s.updates.add(f.filename);
          s.updatePts += 5;
          s.total += 5;
          s.updateFiles.push(f.filename);
        } else {
          s.skippedFiles.push({ file: f.filename, status: f.status, reason: "Already counted in this user's updates", pr: pr.number });
        }
      } else if (f.status === "renamed") {
        s.skippedFiles.push({ file: f.filename, status: f.status, reason: "Renamed files score 0pt", pr: pr.number });
      } else {
        s.skippedFiles.push({ file: f.filename, status: f.status, reason: `Status '${f.status}' not counted`, pr: pr.number });
      }
    }
  }

  // Finalize
  for (const s of Object.values(scores)) {
    s.updateFiles = [...s.updates];
  }

  return scores;
}

function detectAnomalies(scores: ReturnType<typeof computeScores>) {
  const anomalies: string[] = [];

  for (const [login, s] of Object.entries(scores)) {
    if (s.updatePts > 50) {
      anomalies.push(`⚠ @${login}: ${s.updateFiles.length} plan updates → ${s.updatePts}pt (no cap on updates)`);
    }
    if (s.skippedFiles.filter((f) => f.status === "renamed").length > 0) {
      anomalies.push(`⚠ @${login}: ${s.skippedFiles.filter((f) => f.status === "renamed").length} renamed file(s) → 0pt`);
    }
    if (s.skippedPRs.length > 0) {
      anomalies.push(`ℹ @${login}: ${s.skippedPRs.length} PR(s) past cap → 0pt`);
    }
  }

  return anomalies;
}

async function main() {
  const filter = process.argv.find((a) => a.startsWith("--filter="))?.split("=")[1] || "all";
  const sinceDate = SESSION_DATES[filter] || SESSION_DATES.all;
  console.log(`\nLeaderboard audit — filter: ${filter} (since ${sinceDate.slice(0, 10)})\n`);

  const prs = await fetchAllMergedPRs();
  const scores = computeScores(prs, sinceDate);

  const sorted = Object.entries(scores)
    .map(([login, s]) => ({ login, ...s }))
    .sort((a, b) => b.total - a.total);

  // === Per-user breakdown ===
  console.log("=== Per-user breakdown ===\n");
  for (const s of sorted) {
    console.log(`@${s.login}:`);
    for (const pr of s.prList) {
      console.log(`  PR #${pr.num} (${pr.date}) "${pr.title.slice(0, 60)}" — +10pt`);
    }
    if (s.newPlanFiles.length) {
      console.log(`  New plans (${s.newPlans}): ${s.newPlanPts}pt`);
      for (const f of s.newPlanFiles) console.log(`    + ${f}`);
    }
    if (s.updateFiles.length) {
      console.log(`  Plan updates (${s.updateFiles.length}): ${s.updatePts}pt`);
      for (const f of s.updateFiles) console.log(`    ~ ${f}`);
    }
    if (s.skippedPRs.length) {
      console.log(`  Skipped PRs: ${s.skippedPRs.map((p) => `#${p.num}`).join(", ")} (${s.skippedPRs[0].reason})`);
    }
    if (s.skippedFiles.filter((f) => f.status === "renamed").length) {
      console.log(`  Renamed (0pt): ${s.skippedFiles.filter((f) => f.status === "renamed").map((f) => f.file.split("/").pop()).join(", ")}`);
    }
    console.log(`  ─ Total: ${s.total}pt (${s.prPts}pt PRs + ${s.newPlanPts}pt plans + ${s.updatePts}pt updates)\n`);
  }

  // === Anomalies ===
  const anomalies = detectAnomalies(scores);
  if (anomalies.length) {
    console.log("=== Anomalies ===\n");
    for (const a of anomalies) console.log(a);
    console.log();
  } else {
    console.log("=== No anomalies detected ===\n");
  }

  // === Summary ===
  console.log("=== Summary ===");
  console.log(`Total merged PRs:    ${prs.length}`);
  console.log(`Unique contributors: ${sorted.length}`);
  console.log(`Top scorer:          @${sorted[0]?.login ?? "—"} with ${sorted[0]?.total ?? 0}pt`);

  // === Save to file ===
  const auditsDir = join(process.cwd(), "audits");
  if (!existsSync(auditsDir)) mkdirSync(auditsDir);
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const outPath = join(auditsDir, `leaderboard-audit_${filter}_${ts}.json`);
  writeFileSync(outPath, JSON.stringify({ filter, sinceDate, generatedAt: new Date().toISOString(), scores: sorted }, null, 2));
  console.log(`\nFull audit saved: ${outPath}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
