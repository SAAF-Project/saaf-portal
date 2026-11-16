import { STANDARDS } from "../components/temple/standards/standards";

// The scoring of the hardening day (Session 11, 17 November 2026). Pure: it gets the history of every repo with the
// grader's levels per state and returns the three prizes, the people and the feed. No GitHub, no database, so the same
// code runs in the portal and in the simulation of 100 kinds of participants (leaderboard-sim.test.ts).
//
// Quality, not speed:
// - Every standard has a level (0 to its maximum), set by the grader (a private skill that checks content and evidence).
//   Points rise faster than levels (POINTS): the last step counts most, so depth beats breadth. SECURITY.md is arranged
//   by the foundation and counts for nothing.
// - Points go to whoever raised a level, and only by as much as it stays raised at the end: the author of a step gets
//   the rise of the running best, capped at the final level. Nonsense is level 0 and earns nothing; improving someone
//   else's README from 1 to 3 earns 2; removing a file and putting it back earns nothing; the second of two people
//   who fix the same thing gets only what they improved. Per repo the credits add up to exactly end minus start.
// - Quick standards (licence, dependencies, CODEOWNERS, CI) count for at most QUICK_CAP points per person, so copying
//   a licence and a workflow into twenty repos does not win.
// - A repo made during the day starts at its first state: what a template brings in is nobody's work.
// - Only what lands on the default branch by the close counts (16:15): after it come the last review and the demos.
// - Whoever tries to steer the grader (prompt injection, flagged by the grader and confirmed by an organiser) is
//   disqualified: their credits go to nobody.

export type StandardId = (typeof STANDARDS)[number]["id"];
export type Levels = Partial<Record<string, number>>;

export const LEVEL_MAX: Record<string, number> = {
  readme: 3,
  "agent-yaml": 3,
  "audit-criteria": 3,
  security: 0,
  licence: 1,
  tests: 3,
  dependencies: 2,
  ci: 3,
  codeowners: 1,
};
/**
 * Points per level. The last step counts most, so depth beats breadth: one README taken to level 3 (10 points) is worth
 * more than four READMEs at level 1 (2 each), which an AI writes in minutes. Tuned with leaderboard-sim.test.ts.
 */
export const POINTS: Record<string, number[]> = {
  readme: [0, 2, 5, 10],
  "audit-criteria": [0, 2, 5, 10],
  "agent-yaml": [0, 1, 2, 5],
  tests: [0, 1, 2, 5],
  ci: [0, 1, 2, 4],
  dependencies: [0, 1, 2],
  licence: [0, 1],
  codeowners: [0, 1],
  security: [0],
};
/** Standards anyone can add in minutes by copying a file. Together they count for at most QUICK_CAP points per person. */
export const QUICK = new Set(["licence", "dependencies", "codeowners", "ci"]);
export const QUICK_CAP = 6;
/** A repo must gain at least this many points today to compete for best agent. */
export const BEST_MIN_GAIN = 4;
export const MAX_POINTS = Object.values(POINTS).reduce((n, row) => n + row[row.length - 1], 0);

/** Points for one standard at one level. */
export const pointsAt = (id: string, level: number | undefined): number => {
  const row = POINTS[id] ?? [0];
  return row[Math.max(0, Math.min(level ?? 0, row.length - 1))];
};

const IDS = Object.keys(LEVEL_MAX);
const isBot = (login: string | null): boolean => !login || login.endsWith("[bot]");

export function points(levels: Levels | null): number {
  if (!levels) return 0;
  return IDS.reduce((n, id) => n + pointsAt(id, levels[id]), 0);
}

/** One state of a repo's default branch during the day. `levels` is null while the grader has not seen it yet. */
export interface DayStep {
  sha: string;
  at: string;
  login: string | null;
  /** For a merged pull request: when it was opened. */
  opened_at?: string | null;
  url?: string | null;
  levels: Levels | null;
}

export interface RepoDay {
  name: string;
  url: string;
  /** Made during the day: its first state is its start. */
  made_today: boolean;
  start: Levels | null;
  steps: DayStep[];
}

export interface Contribution {
  login: string;
  repo: string;
  standard: string;
  from: number;
  to: number;
  points: number;
  at: string;
  url: string | null;
}

export interface RepoScore {
  name: string;
  url: string;
  made_today: boolean;
  before: number;
  after: number;
  gain: number;
  /** When the repo first reached its final points. Breaks ties. */
  settled_at: string | null;
  by: string[];
  levels: Levels;
  /** Steps whose levels are not known yet. */
  pending: number;
  /** Points that rose today, per standard summed: credited to people plus uncredited (bots, unknown, disqualified). */
  rise: number;
  credited: number;
  uncredited: number;
}

export interface PersonScore {
  login: string;
  points: number;
  /** Points from quick standards that fell above the cap. */
  capped: number;
  repos: string[];
  last_at: string;
  contributions: Contribution[];
}

export interface FeedItem {
  at: string;
  login: string | null;
  repo: string;
  changes: { standard: string; from: number; to: number }[];
  pending: boolean;
  url: string | null;
}

export interface DayScore {
  best_agent: RepoScore[];
  most_improved: RepoScore[];
  top_contributor: PersonScore[];
  repos: RepoScore[];
  feed: FeedItem[];
  total: { start: number; now: number };
}

export interface Window {
  end: string;
  /** Count steps up to this moment (now during the day, the end after it). */
  until: string;
}

const byTime = (a: string | null, b: string | null): number => (a === b ? 0 : a === null ? 1 : b === null ? -1 : a < b ? -1 : 1);

/** Does this step count: it landed by the close and by the moment of counting. */
export function counts(step: DayStep, w: Window): boolean {
  return step.at <= w.until && step.at <= w.end;
}

/** Score the day. */
export function scoreDay(repos: RepoDay[], w: Window, shown = 5, disqualified: Set<string> = new Set()): DayScore {
  const scores: RepoScore[] = [];
  const contributions: Contribution[] = [];
  const feed: FeedItem[] = [];

  for (const r of repos) {
    const steps = r.steps.filter((s) => counts(s, w));
    const graded = steps.filter((s) => s.levels !== null);
    // A repo made today starts at its first state: the template is nobody's work.
    const startLevels: Levels = r.made_today ? (graded[0]?.levels ?? {}) : (r.start ?? {});
    const scored = r.made_today ? graded.slice(1) : graded;
    const final: Levels = graded.length > 0 ? graded[graded.length - 1].levels! : startLevels;
    const before = points(startLevels);
    const after = points(final);

    // Credit: per standard, each step gets the rise of the running best, capped at the final level.
    const by = new Map<string, number>();
    let rise = 0;
    let uncredited = 0;
    for (const id of IDS) {
      if (!LEVEL_MAX[id]) continue;
      const top = final[id] ?? 0;
      let best = Math.min(startLevels[id] ?? 0, top);
      rise += Math.max(0, pointsAt(id, top) - pointsAt(id, startLevels[id] ?? 0));
      for (const s of scored) {
        const lv = Math.min(s.levels![id] ?? 0, top);
        if (lv > best) {
          const gained = pointsAt(id, lv) - pointsAt(id, best);
          if (isBot(s.login) || disqualified.has(s.login!)) uncredited += gained;
          else {
            contributions.push({ login: s.login!, repo: r.name, standard: id, from: best, to: lv, points: gained, at: s.at, url: s.url ?? null });
            by.set(s.login!, (by.get(s.login!) ?? 0) + gained);
          }
          best = lv;
        }
      }
    }

    const settled = after > before ? (scored.find((s) => points(s.levels) >= after)?.at ?? null) : null;
    scores.push({
      name: r.name,
      url: r.url,
      made_today: r.made_today,
      before,
      after,
      gain: after - before,
      settled_at: settled,
      by: [...by.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([l]) => l),
      levels: final,
      pending: steps.length - graded.length,
      rise,
      credited: rise - uncredited,
      uncredited,
    });

    // Feed: every counted step, with what changed (levels when graded).
    let prev: Levels = r.start ?? {};
    for (const s of steps) {
      const changes = s.levels ? IDS.filter((id) => LEVEL_MAX[id] && (s.levels![id] ?? 0) !== (prev[id] ?? 0)).map((id) => ({ standard: id, from: prev[id] ?? 0, to: s.levels![id] ?? 0 })) : [];
      feed.push({ at: s.at, login: s.login, repo: r.name, changes, pending: s.levels === null, url: s.url ?? null });
      if (s.levels) prev = s.levels;
    }
  }

  // People, with the cap on quick standards (applied in time order, so the first quick points count).
  const people = new Map<string, PersonScore>();
  const quickSoFar = new Map<string, number>();
  for (const c of [...contributions].sort((a, b) => byTime(a.at, b.at))) {
    const p = people.get(c.login) ?? { login: c.login, points: 0, capped: 0, repos: [], last_at: c.at, contributions: [] };
    let pts = c.points;
    if (QUICK.has(c.standard)) {
      const used = quickSoFar.get(c.login) ?? 0;
      const room = Math.max(0, QUICK_CAP - used);
      pts = Math.min(pts, room);
      quickSoFar.set(c.login, used + c.points);
      p.capped += c.points - pts;
    }
    p.points += pts;
    if (!p.repos.includes(c.repo)) p.repos.push(c.repo);
    if (pts > 0 && c.at > p.last_at) p.last_at = c.at;
    p.contributions.push(c);
    people.set(c.login, p);
  }

  const best = scores
    .filter((s) => s.gain >= BEST_MIN_GAIN)
    .sort((a, b) => b.after - a.after || byTime(a.settled_at, b.settled_at) || a.name.localeCompare(b.name));
  const improved = scores
    .filter((s) => !s.made_today && s.gain > 0)
    .sort((a, b) => b.gain - a.gain || byTime(a.settled_at, b.settled_at) || a.name.localeCompare(b.name));
  const top = [...people.values()]
    .filter((p) => p.points > 0)
    .sort((a, b) => b.points - a.points || byTime(a.last_at, b.last_at) || a.login.localeCompare(b.login));

  return {
    best_agent: best.slice(0, shown),
    most_improved: improved.slice(0, shown),
    top_contributor: shown === Infinity ? top : top.slice(0, Math.max(shown, 8)),
    repos: scores,
    feed: feed.sort((a, b) => byTime(b.at, a.at)),
    total: { start: scores.filter((s) => !s.made_today).reduce((n, s) => n + s.before, 0), now: scores.filter((s) => !s.made_today).reduce((n, s) => n + s.after, 0) },
  };
}
