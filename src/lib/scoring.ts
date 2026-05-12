import type { PRCache } from "./github";
import type { Plan, ScoreEntry, ActivityEntry } from "@/types";

const LIMITS = { maxPRs: 5, maxNewPlans: 3, maxClaims: 2 };
export const SESSION_DATES: Record<string, string> = {
  h3: "2026-04-21T00:00:00Z",
  h2: "2026-03-24T00:00:00Z",
};

function isPlanFile(filename: string): boolean {
  return /^plans\/.*\.md$/.test(filename) && !filename.endsWith("README.md");
}

export function calculateScores(
  prCache: PRCache,
  plansData: Plan[],
  filter: string = "all"
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
    }))
    .sort(
      (a, b) =>
        b.total - a.total ||
        (a.firstMergedAt || "").localeCompare(b.firstMergedAt || "")
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
