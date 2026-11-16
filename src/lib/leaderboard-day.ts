import { STANDARDS } from "../components/temple/standards/standards";
import { MAX_POINTS, scoreDay, type DayStep, type FeedItem, type Levels, type PersonScore, type RepoDay, type RepoScore } from "./leaderboard";
import type { Graded, BoardState, Proposal } from "./leaderboard-store";
import { stateKey } from "./leaderboard-store";
import type { RepoStandards, StandardsPayload } from "./repo-standards";
import type { History } from "./standards-prizes";

// The day's leaderboard as the portal shows it: the board, the history of every repo, the grader's levels and the
// organisers' controls, turned into the public view (frozen from 15:15, then revealed place by place) or the full view
// for the admin. Pure: everything comes in as arguments, so it is tested without GitHub or a database.

/** The day, in UTC: 09:00 to 16:15 in Amsterdam, frozen for the public from 15:15. */
export const DAY = { start: "2026-11-17T08:00:00Z", end: "2026-11-17T15:15:00Z", freeze: "2026-11-17T14:15:00Z" } as const;
export type Day = { start: string; end: string; freeze: string };

const SHOWN = 5;
const MASKED_TOP = 3;
const FEED = 40;
const IDS = STANDARDS.map((s) => s.id);

export interface RepoRow {
  name: string;
  url: string;
  made_today: boolean;
  before: number;
  after: number;
  gain: number;
  by: string[];
  levels: Levels;
  masked?: boolean;
}

export interface PersonRow {
  login: string;
  points: number;
  capped: number;
  repos: string[];
  contributions: PersonScore["contributions"];
  masked?: boolean;
}

export interface ProposalRow {
  title: string;
  author: string;
  url: string;
  kind: string;
  repo: string;
  score: number;
  verdict?: string;
  feedback?: string | null;
  masked?: boolean;
}

export interface LeaderboardPayload {
  phase: "before" | "during" | "after";
  view: "public" | "admin";
  start: string;
  end: string;
  freeze: string;
  computed_at: string;
  /** The public view shows the standings as they were at the freeze. */
  frozen: boolean;
  /** Places revealed so far, out of all places on the three lists. `null` before the reveal starts. */
  reveal: { step: number; total: number } | null;
  best_agent: RepoRow[];
  most_improved: RepoRow[];
  top_contributor: PersonRow[];
  /** Proposals to improve the standards, scored by the standards review (advice; nothing is merged on the day). */
  proposals: ProposalRow[];
  feed: FeedItem[];
  /** Per repo: standards in place now that were not at the start. The board makes them glow. */
  fresh: Record<string, string[]>;
  totals: { start: number; now: number; max: number } | null;
  graded: { states: number; pending: number; last_at: string | null };
  unread: number;
  /** Admin only. */
  admin?: {
    state: BoardState;
    repos: (RepoScore & { feedback: Record<string, string>; flags: Record<string, string[]>; tree: string | null })[];
    flagged: { repo: string; tree: string; standard: string; flags: string[] }[];
    pending: { repo: string; tree: string; at: string | null }[];
  };
}

export interface DayInput {
  board: StandardsPayload;
  histories: Map<string, History | null>;
  grades: Map<string, Graded>;
  /** All grades, also those given after the freeze: for the admin, the reveal and the grader's to-do list. */
  allGrades: Map<string, Graded>;
  state: BoardState;
  now: string;
  day?: Day;
  view: "public" | "admin";
  /** Proposal scores up to the freeze (public) and all of them (admin, reveal). */
  proposals?: Proposal[];
  allProposals?: Proposal[];
}

const phaseAt = (now: string, d: Day): LeaderboardPayload["phase"] => (now < d.start ? "before" : now < d.end ? "during" : "after");

/** Is the public view frozen now: from the freeze moment, or earlier when an organiser froze it. */
export const isFrozen = (now: string, state: BoardState, d: Day = DAY): boolean => state.frozen || now >= d.freeze;
/** Until when grades count for the public view while it is frozen. */
export const frozenAt = (state: BoardState, d: Day = DAY): string => (state.frozen && state.freezeAt && state.freezeAt < d.freeze ? state.freezeAt : d.freeze);

function days(input: DayInput, grades: Map<string, Graded>, d: Day): { repos: RepoDay[]; unread: number } {
  const out: RepoDay[] = [];
  let unread = 0;
  for (const r of input.board.repos ?? []) {
    const h = input.histories.get(r.name);
    if (!h) {
      unread++;
      continue;
    }
    const made = !!r.created_at && r.created_at >= d.start;
    const level = (tree: string | null) => (tree ? (grades.get(stateKey(r.name, tree))?.levels ?? null) : null);
    const steps: DayStep[] = h.steps.map((s, i) => ({ sha: s.tree ?? `${r.name}-${i}`, at: s.at, login: s.login, opened_at: s.opened_at, url: s.url, levels: level(s.tree) }));
    out.push({ name: r.name, url: r.url, made_today: made, start: made ? {} : level(h.startTree), steps });
  }
  return { repos: out, unread };
}

function fresh(board: StandardsPayload, histories: Map<string, History | null>, d: Day): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const r of board.repos ?? []) {
    const h = histories.get(r.name);
    const made = !!r.created_at && r.created_at >= d.start;
    if (!h && !made) continue;
    const ids = IDS.filter((id) => r.checks[id] === true && !(id === "security" && r.security_by_org) && (made || h?.start[id] !== true));
    if (ids.length > 0) out[r.name] = ids;
  }
  return out;
}

/** The states of every repo that the grader has not seen yet: the start, and every state since. */
export function pendingStates(board: StandardsPayload, histories: Map<string, History | null>, all: Map<string, Graded>): { repo: string; tree: string; at: string | null }[] {
  const out: { repo: string; tree: string; at: string | null }[] = [];
  const seen = new Set<string>();
  const add = (repo: string, tree: string | null | undefined, at: string | null) => {
    if (!tree) return;
    const k = stateKey(repo, tree);
    if (seen.has(k) || all.has(k)) return;
    seen.add(k);
    out.push({ repo, tree, at });
  };
  for (const r of board.repos ?? []) {
    const h = histories.get(r.name);
    if (!h) continue;
    add(r.name, h.startTree, null);
    for (const s of h.steps) add(r.name, s.tree, s.at);
    add(r.name, r.tree_sha, null); // the state the board shows now
  }
  return out;
}

const repoRow = (r: RepoScore): RepoRow => ({ name: r.name, url: r.url, made_today: r.made_today, before: r.before, after: r.after, gain: r.gain, by: r.by, levels: r.levels });
const personRow = (p: PersonScore): PersonRow => ({ login: p.login, points: p.points, capped: p.capped, repos: p.repos, contributions: p.contributions });
const maskRepo = (): RepoRow => ({ name: "?", url: "", made_today: false, before: 0, after: 0, gain: 0, by: [], levels: {}, masked: true });
const maskPerson = (): PersonRow => ({ login: "?", points: 0, capped: 0, repos: [], contributions: [], masked: true });

/**
 * The reveal goes place by place from the bottom: top contributor, most improved, the additions to the standards, and
 * best agent last. Returns, per list, how many of its places (counted from the bottom) are revealed.
 */
export function revealed(step: number, lengths: number[]): number[] {
  let left = step;
  return lengths.map((n) => {
    const shown = Math.min(left, n);
    left -= shown;
    return shown;
  });
}

const PROPOSALS_SHOWN = 3;
const proposalRows = (ps: Proposal[], admin: boolean): ProposalRow[] =>
  [...ps]
    .sort((a, b) => b.score - a.score || a.gradedAt.localeCompare(b.gradedAt))
    .slice(0, admin ? 50 : PROPOSALS_SHOWN)
    .map((p) => ({ title: p.title, author: p.author, url: p.url, kind: p.kind, repo: p.repo, score: p.score, ...(admin ? { verdict: p.verdict, feedback: p.feedback } : {}) }));
const maskProposal = (): ProposalRow => ({ title: "?", author: "?", url: "", kind: "", repo: "", score: 0, masked: true });

/** Hide the places not yet revealed: with `shown` revealed from the bottom, the top `n - shown` stay hidden. */
function hideTop<T>(rows: T[], hiddenFromTop: number, mask: (r: T) => T): T[] {
  return rows.map((r, i) => (i < hiddenFromTop ? mask(r) : r));
}

export function buildLeaderboard(input: DayInput): LeaderboardPayload {
  const d = input.day ?? DAY;
  const phase = phaseAt(input.now, d);
  const admin = input.view === "admin";
  const revealing = input.state.revealStep > 0;
  const frozen = !admin && !revealing && phase !== "before" && isFrozen(input.now, input.state, d);
  // The public sees grades up to the freeze while frozen; the reveal and the admin see all of them.
  const grades = admin || revealing ? input.allGrades : input.grades;
  const until = phase === "after" ? d.end : input.now;
  const { repos, unread } = days(input, grades, d);
  const score = scoreDay(repos, { end: d.end, until }, SHOWN, new Set(input.state.disqualified));

  let best = score.best_agent.map(repoRow);
  let improved = score.most_improved.map(repoRow);
  let people = score.top_contributor.slice(0, 8).map(personRow);
  let proposals = proposalRows((admin || revealing ? input.allProposals : input.proposals) ?? [], admin);
  let reveal: LeaderboardPayload["reveal"] = null;

  if (!admin && revealing) {
    const lists = [Math.min(people.length, SHOWN), improved.length, proposals.length, best.length];
    const total = lists.reduce((n, x) => n + x, 0);
    const [p, m, q, b] = revealed(input.state.revealStep, lists);
    people = hideTop(people.slice(0, SHOWN), lists[0] - p, maskPerson);
    improved = hideTop(improved, lists[1] - m, maskRepo);
    proposals = hideTop(proposals, lists[2] - q, maskProposal);
    best = hideTop(best, lists[3] - b, maskRepo);
    reveal = { step: Math.min(input.state.revealStep, total), total };
  } else if (frozen) {
    people = hideTop(people.slice(0, SHOWN), MASKED_TOP, maskPerson);
    improved = hideTop(improved, MASKED_TOP, maskRepo);
    best = hideTop(best, MASKED_TOP, maskRepo);
    proposals = hideTop(proposals, 1, maskProposal);
  }

  const existing = score.repos.filter((r) => !r.made_today);
  const lastAt = [...input.allGrades.values()].reduce<string | null>((m, g) => (!m || g.gradedAt > m ? g.gradedAt : m), null);
  const pending = pendingStates(input.board, input.histories, input.allGrades);

  const payload: LeaderboardPayload = {
    phase,
    view: input.view,
    start: d.start,
    end: d.end,
    freeze: d.freeze,
    computed_at: input.now,
    frozen,
    reveal,
    best_agent: best,
    most_improved: improved,
    top_contributor: people,
    proposals,
    // While frozen the feed still says who landed what, without the levels the public may not see yet.
    feed: score.feed.slice(0, FEED),
    fresh: phase === "before" ? {} : fresh(input.board, input.histories, d),
    totals: phase === "before" ? null : { start: existing.reduce((n, r) => n + r.before, 0), now: existing.reduce((n, r) => n + r.after, 0), max: existing.length * MAX_POINTS },
    graded: { states: input.allGrades.size, pending: pending.length, last_at: lastAt },
    unread,
  };

  if (admin) {
    const trees = new Map((input.board.repos ?? []).map((r: RepoStandards) => [r.name, r.tree_sha ?? null]));
    const flagged: { repo: string; tree: string; standard: string; flags: string[] }[] = [];
    for (const [key, g] of input.allGrades) {
      const [repo, tree] = key.split(":");
      for (const [standard, flags] of Object.entries(g.flags)) if (flags.length > 0) flagged.push({ repo, tree, standard, flags });
    }
    payload.top_contributor = score.top_contributor.map(personRow);
    payload.admin = {
      state: input.state,
      repos: score.repos
        .map((r) => {
          const tree = trees.get(r.name) ?? null;
          const g = tree ? input.allGrades.get(stateKey(r.name, tree)) : undefined;
          return { ...r, feedback: g?.feedback ?? {}, flags: g?.flags ?? {}, tree };
        })
        .sort((a, b) => b.after - a.after || a.name.localeCompare(b.name)),
      flagged,
      pending,
    };
  }
  return payload;
}
