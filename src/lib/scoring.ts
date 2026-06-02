import type { PRCache, AgentContributions } from "./github";
import type { Plan, ScoreEntry, ActivityEntry } from "@/types";

const LIMITS = { maxPRs: 5, maxNewPlans: 3, maxClaims: 2 };
export const SESSION_DATES: Record<string, string> = {
  h3: "2026-04-21T00:00:00Z",
  h2: "2026-03-24T00:00:00Z",
};

// Agent Builder bonus — rewards quality agent repos in the org, gated on the
// README/reviewed flag rather than raw commit count. Tune freely.
const AGENT_LIMITS = {
  maxRepos: 2, // only your best N qualifying repos count
  perRepo: 8, // points for a repo that clears the README quality gate
  reviewedBonus: 12, // extra if the repo is "reviewed" → reviewed repo = 20
  volumeCap: 10, // hard cap on the lines-changed sub-bonus
};
// Lines-changed tiers (summed across your quality repos). Tiered + hard-capped
// so a single large/generated file can't dominate the leaderboard.
const VOLUME_TIERS = [
  { lines: 6000, pts: 10 },
  { lines: 1500, pts: 6 },
  { lines: 200, pts: 3 },
];

// Central-repo max: 5×10 (PRs) + 3×15 (new plans) + 2×5 (claims) = 105.
// Plan updates are uncapped; 105 is the baseline used for the progress bar.
const CENTRAL_MAX = 105;
export const MAX_SCORE =
  CENTRAL_MAX +
  AGENT_LIMITS.maxRepos * (AGENT_LIMITS.perRepo + AGENT_LIMITS.reviewedBonus) +
  AGENT_LIMITS.volumeCap; // = 155

function volumePoints(lines: number): number {
  for (const t of VOLUME_TIERS) if (lines >= t.lines) return t.pts;
  return 0;
}

// Computes a contributor's Agent Builder bonus: their best `maxRepos` qualifying
// repos (reviewed ones counted first since they're worth more), plus a capped
// lines-changed volume bonus.
function agentBonus(contrib: AgentContributions[string] | undefined): {
  points: number;
  repos: { name: string; reviewed: boolean }[];
} {
  if (!contrib || contrib.repos.length === 0) return { points: 0, repos: [] };
  const ranked = [...contrib.repos].sort(
    (a, b) => Number(b.reviewed) - Number(a.reviewed)
  );
  let points = 0;
  for (const r of ranked.slice(0, AGENT_LIMITS.maxRepos)) {
    points += AGENT_LIMITS.perRepo;
    if (r.reviewed) points += AGENT_LIMITS.reviewedBonus;
  }
  points += Math.min(AGENT_LIMITS.volumeCap, volumePoints(contrib.linesChanged));
  return {
    points,
    repos: ranked.map((r) => ({ name: r.name, reviewed: r.reviewed })),
  };
}

function isPlanFile(filename: string): boolean {
  return /^plans\/.*\.md$/.test(filename) && !filename.endsWith("README.md");
}

export function calculateScores(
  prCache: PRCache,
  plansData: Plan[],
  filter: string = "all",
  agentContributions: AgentContributions = {}
): ScoreEntry[] {
  const sinceDate = SESSION_DATES[filter] || null;

  const scores: Record<
    string,
    {
      prs: number;
      newPlans: number;
      planUpdates: Set<string>;
      claims: number;
      total: number;
      prList: { num: number; title: string; merged_at: string; url: string }[];
      firstMergedAt: string | null;
      lastMergedAt: string | null;
      agentPoints: number;
      agentRepos: { name: string; reviewed: boolean }[];
    }
  > = {};

  const ensure = (login: string) => {
    if (!scores[login]) {
      scores[login] = {
        prs: 0,
        newPlans: 0,
        planUpdates: new Set(),
        claims: 0,
        total: 0,
        prList: [],
        firstMergedAt: null,
        lastMergedAt: null,
        agentPoints: 0,
        agentRepos: [],
      };
    }
  };

  for (const [numStr, pr] of Object.entries(prCache)) {
    if (sinceDate && pr.merged_at < sinceDate) continue;

    const login = pr.author;
    ensure(login);
    const s = scores[login];

    if (s.prs < LIMITS.maxPRs) {
      s.prs++;
      s.total += 10;
    }
    s.prList.push({
      num: parseInt(numStr),
      title: pr.title,
      merged_at: pr.merged_at,
      url: pr.url,
    });
    if (!s.firstMergedAt || pr.merged_at < s.firstMergedAt) {
      s.firstMergedAt = pr.merged_at;
    }
    if (!s.lastMergedAt || pr.merged_at > s.lastMergedAt) {
      s.lastMergedAt = pr.merged_at;
    }

    for (const f of pr.files) {
      if (!isPlanFile(f.filename)) continue;

      if (f.status === "added") {
        if (s.newPlans < LIMITS.maxNewPlans) {
          s.newPlans++;
          s.total += 15;
        }
      } else if (f.status === "modified") {
        if (!s.planUpdates.has(f.filename)) {
          s.planUpdates.add(f.filename);
          s.total += 5;
        }
      }
    }
  }

  const nameToLogin: Record<string, string> = {};
  for (const pr of Object.values(prCache)) {
    for (const f of pr.files) {
      if (isPlanFile(f.filename) && f.status === "added") {
        nameToLogin[f.filename] = pr.author;
      }
    }
  }
  for (const plan of plansData) {
    if (!plan.claimed_by) continue;
    const planPath = `plans/${plan.session}/${plan.slug}.md`;
    const login = nameToLogin[planPath];
    if (login) {
      ensure(login);
      const s = scores[login];
      if (s.claims < LIMITS.maxClaims) {
        s.claims++;
        s.total += 5;
      }
    }
  }

  // Agent Builder bonus — reflects each person's current org agent-repo
  // portfolio. Applied on every filter (it's a portfolio measure, not a
  // time-windowed event stream). Adds new logins who only built agents.
  for (const [login, contrib] of Object.entries(agentContributions)) {
    const { points, repos } = agentBonus(contrib);
    if (points === 0) continue;
    ensure(login);
    const s = scores[login];
    s.agentPoints = points;
    s.agentRepos = repos;
    s.total += points;
  }

  return Object.entries(scores)
    .map(([login, s]) => ({
      login,
      prs: s.prs,
      newPlans: s.newPlans,
      updateCount: s.planUpdates.size,
      claims: s.claims,
      total: s.total,
      prList: s.prList,
      firstMergedAt: s.firstMergedAt,
      lastMergedAt: s.lastMergedAt,
      agentPoints: s.agentPoints,
      agentRepos: s.agentRepos,
    }))
    .sort(
      (a, b) =>
        b.total - a.total ||
        // Tiebreaker: whoever reached this score first (i.e. last PR earliest) ranks higher
        (a.lastMergedAt || "").localeCompare(b.lastMergedAt || "")
    );
}

export function buildActivity(
  prCache: PRCache,
  filter: string = "all",
  limit: number = 25
): ActivityEntry[] {
  const sinceDate = SESSION_DATES[filter] || null;

  return Object.entries(prCache)
    .map(([numStr, pr]) => ({
      num: parseInt(numStr),
      author: pr.author,
      title: pr.title,
      merged_at: pr.merged_at,
      url: pr.url,
      planFiles: pr.files
        .filter((f) => isPlanFile(f.filename))
        .map((f) => ({ filename: f.filename, status: f.status })),
    }))
    .filter((pr) => !sinceDate || pr.merged_at >= sinceDate)
    .sort(
      (a, b) =>
        new Date(b.merged_at).getTime() - new Date(a.merged_at).getTime()
    )
    .slice(0, limit);
}
