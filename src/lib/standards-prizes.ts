import { tally, evaluateStandards, type Checks, type TreeFile } from "../components/temple/standards/standards";
import { mapLimited } from "./repo-signals";
import type { RepoStandards, StandardsPayload } from "./repo-standards";

// The two prizes the standards board decides on the hardening day (Session 11, 17 November 2026), worked out by the
// portal itself from GitHub's history, so nobody has to take snapshots or run a script on the day:
//
//   1. First existing agent with nine tiles: the repo whose default branch first held all nine standards, at the time
//      of the commit that completed it (a merge through GitHub is a new commit made at the moment of the merge).
//   2. Biggest jump: tiles on the default branch at the end of the day minus tiles at the start.
//
// "At the start" and "at the end" are read from history: the newest commit on the default branch at that moment, and
// its file list. That needs no snapshot at 09:00, gives the same answer whenever it is asked, and costs nothing for a
// repo that nobody pushed to since the moment in question (its current answer is the answer then).
//
// Only repos made before the start count: a repo made from the starter template begins with nine tiles. New repos are
// listed for the organisers, who judge them. Who made the difference: the authors of pull requests merged into the repo
// during the day. Missing data is never a zero: a repo whose history could not be read is left out and the answer says so.

/** The day, in UTC: 09:00 to 16:15 in Amsterdam (CET, UTC+1). */
export const HARDENING_DAY = { start: "2026-11-17T08:00:00Z", end: "2026-11-17T15:15:00Z" } as const;

const ORG = "SAAF-Project";
const API = "https://api.github.com";
const TTL_SECONDS = 60;
const CONCURRENCY = 6;
const EMPTY_REPO_STATUS = 409;
/** Commits read in one call when walking a branch back. More than any team makes in a day. */
const MAX_COMMITS = 100;
const SHOWN = 5;

export interface PrizeRow {
  name: string;
  url: string;
  before: number;
  after: number;
  jump: number;
  /** When the default branch first held all nine (ISO), for the first prize. */
  reached_at: string | null;
  /** GitHub logins of the authors of pull requests merged into the repo during the day. */
  by: string[];
}

export interface PrizesPayload {
  phase: "before" | "during" | "after";
  start: string;
  end: string;
  computed_at: string | null;
  first_nine: PrizeRow[];
  biggest_jump: PrizeRow[];
  /** Repos made during the day, with their tiles now. The organisers judge these. */
  new_repos: { name: string; url: string; met: number }[];
  /** Tiles over the repos that existed at the start. `null` before the day. */
  tiles: { start: number; now: number } | null;
  /** How many existing repos could not be read and are left out of the prizes. */
  unread: number;
}

type Fetch = typeof fetch;

async function get(url: string, token: string, fetchImpl: Fetch): Promise<{ status: number; body: unknown }> {
  try {
    const res = await fetchImpl(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
      cache: "no-store",
    });
    return { status: res.status, body: res.ok ? await res.json() : null };
  } catch {
    return { status: 0, body: null };
  }
}

const repoUrl = (name: string, path: string) => `${API}/repos/${ORG}/${encodeURIComponent(name)}/${path}`;

interface Commit {
  sha: string;
  tree: string;
  date: string;
  parents: string[];
}

function toCommit(c: unknown): Commit | null {
  const x = c as { sha?: unknown; parents?: { sha?: unknown }[]; commit?: { tree?: { sha?: unknown }; committer?: { date?: unknown } } } | null;
  const sha = x?.sha;
  const tree = x?.commit?.tree?.sha;
  const date = x?.commit?.committer?.date;
  const parents = Array.isArray(x?.parents) ? x.parents.map((p) => p?.sha).filter((p): p is string => typeof p === "string") : [];
  return typeof sha === "string" && typeof tree === "string" && typeof date === "string" ? { sha, tree, date, parents } : null;
}

/**
 * The states the default branch went through, newest first: HEAD and its first parents, back to and including the first
 * commit made at or before `stopAt` (or the first commit of the repo). Following first parents skips the commits of a
 * merged branch, which were never on the default branch on their own. `[]` = a repo without commits; `null` = no answer.
 */
async function walk(name: string, stopAt: string, token: string, fetchImpl: Fetch): Promise<Commit[] | null> {
  const page = await get(repoUrl(name, "commits?per_page=100"), token, fetchImpl);
  if (page.status === EMPTY_REPO_STATUS) return [];
  if (!Array.isArray(page.body) || page.body.length === 0) return null;
  const known = new Map<string, Commit>();
  for (const raw of page.body) {
    const c = toCommit(raw);
    if (c) known.set(c.sha, c);
  }
  const head = toCommit(page.body[0]);
  if (!head) return null;
  const chain: Commit[] = [];
  let at: Commit | null = head;
  for (let step = 0; at && step < MAX_COMMITS * 3; step++) {
    chain.push(at);
    if (at.date <= stopAt || at.parents.length === 0) return chain;
    const parent: string = at.parents[0];
    let next = known.get(parent) ?? null;
    if (!next) {
      const res = await get(repoUrl(name, `commits/${parent}`), token, fetchImpl);
      next = toCommit(res.body);
      if (!next) return null;
    }
    at = next;
  }
  return null;
}

/** The nine answers for one tree. `null` = no answer, or an answer with a standard that cannot be told. */
async function checksOfTree(name: string, tree: string, token: string, fetchImpl: Fetch): Promise<Checks | null> {
  const res = await get(repoUrl(name, `git/trees/${tree}?recursive=1`), token, fetchImpl);
  const body = res.body as { tree?: { path: string; type: string; size?: number }[]; truncated?: boolean } | null;
  if (!body || !Array.isArray(body.tree)) return null;
  const files: TreeFile[] = body.tree.filter((e) => e.type === "blob").map((e) => ({ path: e.path, size: typeof e.size === "number" ? e.size : 0 }));
  const checks = evaluateStandards(files, !!body.truncated);
  return Object.values(checks).every((v) => v !== null) ? checks : null;
}

const NOTHING: Checks = evaluateStandards([], false);

/**
 * Tiles on the default branch at moment `at`. A repo nobody pushed to since then has its current answer; otherwise the
 * branch is walked back to that moment. A repo without a commit at that moment has none. `null` = could not be read.
 */
async function metAt(repo: RepoStandards, at: string, token: string, fetchImpl: Fetch): Promise<number | null> {
  if (repo.pushed_at && repo.pushed_at <= at) {
    const t = tally(repo.checks);
    return t.unknown === 0 ? t.met : null;
  }
  const chain = await walk(repo.name, at, token, fetchImpl);
  if (!chain) return null;
  const then = chain[chain.length - 1];
  if (!then || then.date > at) return tally(NOTHING).met;
  const checks = await checksOfTree(repo.name, then.tree, token, fetchImpl);
  return checks ? tally(checks).met : null;
}

/** The time of the first state of the default branch during the day that held all nine. `null` = not found. */
async function reachedAt(name: string, from: string, until: string, token: string, fetchImpl: Fetch): Promise<string | null> {
  const chain = await walk(name, from, token, fetchImpl);
  if (!chain) return null;
  const day = chain.filter((c) => c.date > from && c.date <= until).reverse();
  for (const c of day) {
    const checks = await checksOfTree(name, c.tree, token, fetchImpl);
    if (checks && tally(checks).complete) return c.date;
  }
  return null;
}

/** Logins of the authors of pull requests merged into the repo between `from` and `until`. */
async function mergedBy(name: string, from: string, until: string, token: string, fetchImpl: Fetch): Promise<string[]> {
  const res = await get(repoUrl(name, "pulls?state=closed&sort=updated&direction=desc&per_page=100"), token, fetchImpl);
  if (!Array.isArray(res.body)) return [];
  const logins = new Set<string>();
  for (const pr of res.body as { merged_at?: unknown; user?: { login?: unknown } }[]) {
    const at = pr.merged_at;
    const login = pr.user?.login;
    // bots such as Dependabot do not win prizes
    if (typeof at === "string" && at >= from && at <= until && typeof login === "string" && !login.endsWith("[bot]")) logins.add(login);
  }
  return [...logins].sort((a, b) => a.localeCompare(b));
}

// Kept per server instance. The past does not change, so tiles at the start, tiles at the end and the moment a repo
// was completed are kept once known. Pull request authors are kept until the repo is pushed again.
const startMet = new Map<string, number>();
const endMet = new Map<string, number>();
const reached = new Map<string, string>();
const authors = new Map<string, { pushed_at: string | null; logins: string[] }>();
let memo: { at: number; value: Promise<PrizesPayload> } | null = null;

type Day = { start: string; end: string };

const phaseAt = (nowIso: string, day: Day): PrizesPayload["phase"] => (nowIso < day.start ? "before" : nowIso < day.end ? "during" : "after");

async function compute(board: StandardsPayload, token: string, fetchImpl: Fetch, nowIso: string, day: Day): Promise<PrizesPayload> {
  const { start, end } = day;
  const phase = phaseAt(nowIso, day);
  const empty: PrizesPayload = { phase, start, end, computed_at: nowIso, first_nine: [], biggest_jump: [], new_repos: [], tiles: null, unread: 0 };
  if (phase === "before" || !board.repos) return { ...empty, computed_at: board.repos ? nowIso : null };

  const until = phase === "after" ? end : nowIso;
  const existing = board.repos.filter((r) => r.created_at !== null && r.created_at < start);
  const made = board.repos.filter((r) => r.created_at !== null && r.created_at >= start);

  const rows = await mapLimited(existing, CONCURRENCY, async (repo): Promise<PrizeRow | null> => {
    let before = startMet.get(repo.name);
    if (before === undefined) {
      const met = await metAt(repo, start, token, fetchImpl);
      if (met === null) return null;
      startMet.set(repo.name, met);
      before = met;
    }
    let after: number | undefined;
    if (phase === "after") {
      after = endMet.get(repo.name);
      if (after === undefined) {
        const met = await metAt(repo, end, token, fetchImpl);
        if (met === null) return null;
        endMet.set(repo.name, met);
        after = met;
      }
    } else {
      const t = tally(repo.checks);
      if (t.unknown > 0) return null;
      after = t.met;
    }
    return { name: repo.name, url: repo.url, before, after, jump: after - before, reached_at: null, by: [] };
  });

  const read = rows.filter((r): r is PrizeRow => r !== null);
  const total = tally(NOTHING).total;

  // First prize: repos that were not complete at the start and are complete now (or at the end).
  const finishers = read.filter((r) => r.before < total && r.after === total);
  await mapLimited(finishers, CONCURRENCY, async (r) => {
    const known = reached.get(r.name);
    if (known) {
      r.reached_at = known;
      return;
    }
    const at = await reachedAt(r.name, start, until, token, fetchImpl);
    if (at) reached.set(r.name, at);
    r.reached_at = at;
  });
  const firstNine = finishers
    .filter((r) => r.reached_at !== null)
    .sort((a, b) => (a.reached_at! < b.reached_at! ? -1 : a.reached_at! > b.reached_at! ? 1 : a.name.localeCompare(b.name)))
    .slice(0, SHOWN);

  const biggest = read
    .filter((r) => r.jump > 0)
    .sort((a, b) => b.jump - a.jump || b.after - a.after || a.name.localeCompare(b.name))
    .slice(0, SHOWN);

  // Who did it, for the rows on screen only.
  const pushedOf = new Map(board.repos.map((r) => [r.name, r.pushed_at]));
  const shown = [...new Set([...firstNine, ...biggest])];
  await mapLimited(shown, CONCURRENCY, async (r) => {
    const pushed = pushedOf.get(r.name) ?? null;
    const kept = authors.get(r.name);
    if (kept && kept.pushed_at === pushed) {
      r.by = kept.logins;
      return;
    }
    r.by = await mergedBy(r.name, start, until, token, fetchImpl);
    authors.set(r.name, { pushed_at: pushed, logins: r.by });
  });

  return {
    ...empty,
    first_nine: firstNine,
    biggest_jump: biggest,
    new_repos: made
      .map((r) => ({ name: r.name, url: r.url, met: tally(r.checks).met }))
      .sort((a, b) => b.met - a.met || a.name.localeCompare(b.name)),
    tiles: { start: read.reduce((n, r) => n + r.before, 0), now: read.reduce((n, r) => n + r.after, 0) },
    unread: existing.length - read.length,
  };
}

/** The prizes, from the board's data and GitHub's history. Never throws; worked out at most once a minute per instance. */
export async function loadPrizes(
  board: StandardsPayload,
  fetchImpl: Fetch = fetch,
  token: string | undefined = process.env.GITHUB_PAT,
  now: () => number = Date.now,
  day: Day = HARDENING_DAY,
): Promise<PrizesPayload> {
  const nowIso = new Date(now()).toISOString();
  const fallback: PrizesPayload = {
    phase: phaseAt(nowIso, day),
    start: day.start,
    end: day.end,
    computed_at: null,
    first_nine: [],
    biggest_jump: [],
    new_repos: [],
    tiles: null,
    unread: 0,
  };
  if (!token) return fallback;
  if (memo && now() - memo.at < TTL_SECONDS * 1000) return memo.value;
  const entry = { at: now(), value: compute(board, token, fetchImpl, nowIso, day).catch(() => fallback) };
  memo = entry;
  return entry.value;
}

/** For tests: forget everything that is kept. */
export function resetPrizesMemo(): void {
  memo = null;
  startMet.clear();
  endMet.clear();
  reached.clear();
  authors.clear();
}
