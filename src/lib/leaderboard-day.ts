import { STANDARDS } from "../components/temple/standards/standards";
import { EMPTY_CHECKS, type ChecksDoc } from "./day-checks";
import { TRACK1_PRIZE } from "./day-tracks";
import { MAX_POINTS, scoreDay, type DayStep, type FeedItem, type Levels, type PersonScore, type RepoDay, type RepoScore } from "./leaderboard";
import type { Graded, BoardState, Proposal } from "./leaderboard-store";
import { stateKey } from "./leaderboard-store";
import type { RepoStandards, StandardsPayload } from "./repo-standards";
import type { History } from "./standards-prizes";

// The day's leaderboard as the portal shows it: the board, the history of every repo, the grader's levels and the
// organisers' controls, turned into the public view (frozen from 15:15, then revealed place by place) or the full view
// for the admin. Pure: everything comes in as arguments, so it is tested without GitHub or a database.
//
// The day has three tracks (src/lib/day-tracks.ts), each with one prize: track 1 is one of the two repo lists (see
// TRACK1_PRIZE), track 2 the proposals, track 3 the LLM checks. The other repo list and the top contributors are
// honourable mentions.

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

/** Track 3: a repo with LLM checks. The place is the jury's and shows only in the reveal and for the admin. */
export interface CheckRow {
  repo: string;
  url: string;
  authors: string[];
  llm: number;
  code: number;
  place?: number | null;
  score?: number;
  feedback?: string | null;
  flags?: string[];
  /** What the jury said: only on a place that is revealed, and for the admin. */
  jury?: { score: number | null; max: number; parts: Record<string, number>; reason: string };
  masked?: boolean;
}

export type Track1Prize = "most_improved" | "best_agent";

export interface LeaderboardPayload {
  phase: "before" | "during" | "after";
  view: "public" | "admin";
  start: string;
  end: string;
  freeze: string;
  computed_at: string;
  /** The public view shows the standings as they were at the freeze. */
  frozen: boolean;
  /** Steps of the prize-giving shown so far, out of all of them. `null` before the reveal starts. */
  reveal: { step: number; total: number } | null;
  /** Which of the two repo lists carries the prize of track 1. */
  prize: Track1Prize;
  best_agent: RepoRow[];
  most_improved: RepoRow[];
  top_contributor: PersonRow[];
  /** Proposals to improve the standards, scored by the standards review (advice; nothing is merged on the day). */
  proposals: ProposalRow[];
  /** Track 3: repos with LLM checks, most checks first; in the reveal the jury's places come first. */
  checks: CheckRow[];
  /** How many repos have LLM checks. */
  checks_total: number;
  /** Who judged track 3: once a place of that track is revealed, and for the admin. */
  checks_jury?: string[];
  /** How many participants the organisers disqualified. The public sees the number, never the names. */
  disqualified: number;
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
    /** How many steps the prize-giving has with the standings as they are now. */
    reveal_total: number;
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
  /** Track 3: the repos with LLM checks and the jury's places. */
  checks?: ChecksDoc;
  /** Which repo list carries the prize of track 1. Default: TRACK1_PRIZE. */
  prize?: Track1Prize;
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
 * The prize-giving goes step by step: first the two honourable mentions (top contributors, and the repo list without a
 * prize), one step each; then track 3, track 2 and track 1, each from the third place up to the winner. Given the steps
 * taken and the steps each part has, returns how many steps of each part are shown.
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

const CHECKS_SHOWN = 8;
const maskCheck = (): CheckRow => ({ repo: "?", url: "", authors: [], llm: 0, code: 0, place: null, masked: true });

/**
 * Track 3. The public sees the repos with LLM checks, most checks first, without places. In the reveal and for the
 * admin the jury's places come first.
 */
function checkRows(doc: ChecksDoc, mode: "public" | "reveal" | "admin"): CheckRow[] {
  const said = (repo: string) => {
    const j = doc.jury?.results[repo];
    return j && doc.jury ? { jury: { score: j.score, max: doc.jury.max, parts: j.parts, reason: j.reason } } : {};
  };
  const rows: CheckRow[] = doc.candidates
    .filter((c) => c.llm > 0 || mode === "admin")
    .map((c) => ({
      repo: c.repo,
      url: `https://github.com/SAAF-Project/${encodeURIComponent(c.repo)}`,
      authors: c.authors,
      llm: c.llm,
      code: c.code,
      ...(mode === "public" ? {} : { place: doc.places[c.repo] ?? null }),
      ...(mode === "admin" ? { score: c.score, feedback: c.feedback, flags: c.flags } : {}),
      // A hidden place is masked afterwards (hideTop), so what the jury said shows only with a revealed place.
      ...(mode === "admin" || (mode === "reveal" && doc.places[c.repo]) ? said(c.repo) : {}),
    }));
  rows.sort((a, b) => (a.place ?? 9) - (b.place ?? 9) || b.llm - a.llm || a.repo.localeCompare(b.repo));
  return mode === "admin" ? rows : rows.slice(0, CHECKS_SHOWN);
}

/** The steps of the prize-giving, per part: the two mentions, track 3, track 2, track 1. */
function revealSteps(people: number, other: number, placedChecks: number, proposals: number, prize: number): number[] {
  const top = (n: number) => Math.min(n, MASKED_TOP);
  return [people > 0 ? 1 : 0, other > 0 ? 1 : 0, top(placedChecks), top(proposals), top(prize)];
}

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
  // A disqualified participant wins nothing: no credit in track 1 (scoreDay), no proposal in track 2 and no place in
  // track 3. The admin keeps seeing everything.
  const out = new Set(input.state.disqualified.map((login) => login.toLowerCase()));
  const isOut = (login: string) => out.has(login.toLowerCase());
  const allowed = <T extends { author: string }>(ps: T[]): T[] => (admin ? ps : ps.filter((p) => !isOut(p.author)));
  let proposals = proposalRows(allowed((admin || revealing ? input.allProposals : input.proposals) ?? []), admin);
  const rawChecks = input.checks ?? EMPTY_CHECKS;
  const keptChecks = rawChecks.candidates
    .map((c) => ({ ...c, authors: c.authors.filter((a) => !isOut(a)) }))
    .filter((c, i) => c.authors.length > 0 || rawChecks.candidates[i].authors.length === 0);
  const checksDoc: ChecksDoc = admin
    ? rawChecks
    : { ...rawChecks, candidates: keptChecks, places: Object.fromEntries(Object.entries(rawChecks.places).filter(([repo]) => keptChecks.some((c) => c.repo === repo))) };
  let checks = checkRows(checksDoc, admin ? "admin" : revealing ? "reveal" : "public");
  const prize: Track1Prize = input.prize ?? TRACK1_PRIZE;
  const placed = Object.keys(rawChecks.places).filter((repo) => keptChecks.some((c) => c.repo === repo)).length;
  const steps = revealSteps(people.length, (prize === "most_improved" ? best : improved).length, placed, proposals.length, (prize === "most_improved" ? improved : best).length);
  const revealTotal = steps.reduce((n, x) => n + x, 0);
  let reveal: LeaderboardPayload["reveal"] = null;
  let jury: string[] | null = admin && rawChecks.jury ? rawChecks.jury.names : null;

  if (!admin && revealing) {
    const [p, o, c, q, w] = revealed(input.state.revealStep, steps);
    if (c > 0 && rawChecks.jury) jury = rawChecks.jury.names;
    const mention = (rows: RepoRow[]) => (o ? rows : hideTop(rows, MASKED_TOP, maskRepo));
    const winner = (rows: RepoRow[]) => hideTop(rows, steps[4] - w, maskRepo);
    people = p ? people.slice(0, SHOWN) : hideTop(people.slice(0, SHOWN), MASKED_TOP, maskPerson);
    improved = prize === "most_improved" ? winner(improved) : mention(improved);
    best = prize === "most_improved" ? mention(best) : winner(best);
    checks = hideTop(checks, steps[2] - c, maskCheck);
    proposals = hideTop(proposals, steps[3] - q, maskProposal);
    reveal = { step: Math.min(input.state.revealStep, revealTotal), total: revealTotal };
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
    prize,
    best_agent: best,
    most_improved: improved,
    top_contributor: people,
    proposals,
    checks,
    checks_total: checksDoc.candidates.filter((c) => c.llm > 0).length,
    ...(jury ? { checks_jury: jury } : {}),
    disqualified: input.state.disqualified.length,
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
      reveal_total: revealTotal,
    };
  }
  return payload;
}
