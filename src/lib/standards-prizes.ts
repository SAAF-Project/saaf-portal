import { tally, evaluateStandards, STANDARDS, type Checks, type TreeFile } from "../components/temple/standards/standards";
import { mapLimited } from "./repo-signals";
import type { RepoStandards, StandardsPayload } from "./repo-standards";

// The day's leaderboard of the standards board on the hardening day (Session 11, 17 November 2026), worked out by the
// portal itself from GitHub's history, so nobody has to take snapshots or run a script on the day.
//
//   1. First prize: the first existing agent whose default branch held all nine standards, at GitHub's own time of the
//      push or merge that completed it. It must still hold all nine at the end.
//   2. Biggest jump: standards on the default branch at the end of the day minus standards at the start. A tie goes to
//      the repo that reached its final count first.
//   3. Most standards added, by person: every standard that is in place at the end and was not at the start is credited
//      to one person: whoever brought it onto the default branch first. Removed and put back, it stays with that person.
//
// The history of the default branch comes from GitHub's repository activity: every push and merge, with GitHub's own
// timestamp, the state before and after, and who did it. Commit dates play no part, so they cannot be set to win.
// For a merged pull request the credit goes to the author of the pull request, not to whoever pressed merge. For a
// direct push it goes to whoever pushed. Bots get no credit. If a repo's activity cannot be read, the first-parent
// history of the branch with its commit dates is used instead.
//
// Only repos made before the start count: a repo made from the starter template begins with all nine. New repos are
// listed for the organisers, who judge them. Missing data is never a zero: a repo whose history cannot be read is left
// out and the answer says how many.

/** The day, in UTC: 09:00 to 16:15 in Amsterdam (CET, UTC+1). */
export const HARDENING_DAY = { start: "2026-11-17T08:00:00Z", end: "2026-11-17T15:15:00Z" } as const;

const ORG = "SAAF-Project";
const API = "https://api.github.com";
const TTL_SECONDS = 60;
const CONCURRENCY = 6;
const EMPTY_REPO_STATUS = 409;
/** Commits or activities read in one call. More than any repo sees in a day. */
const PAGE = 100;
const SHOWN = 5;
const PEOPLE_SHOWN = 8;
const ZERO_SHA = /^0+$/;
/** GitHub answers these when the activity of a repo is not there to read; the commit history is used instead. */
const NO_ACTIVITY = new Set([403, 404, 410, 422]);

export interface PrizeRow {
  name: string;
  url: string;
  before: number;
  after: number;
  jump: number;
  /** When the default branch first held all nine (GitHub's time, ISO), for the first prize. */
  reached_at: string | null;
  /** When the repo first reached its final count during the day. Breaks a tie in the biggest jump. */
  settled_at: string | null;
  /** The people credited with standards in this repo, most first. */
  by: string[];
  /** Standards in place at the start. */
  had: string[];
  /** Standards in place now (at the end, after the day) that were not at the start. */
  added: string[];
}

export interface PersonRow {
  login: string;
  /** Standards credited to this person, over all existing repos. */
  added: number;
  repos: string[];
  /** When the last of them landed. Breaks a tie: whoever got there first ranks higher. */
  last_at: string;
}

export interface PrizesPayload {
  phase: "before" | "during" | "after";
  start: string;
  end: string;
  computed_at: string | null;
  first_nine: PrizeRow[];
  /** The existing repos nearest to all nine that do not have them yet. */
  closest: PrizeRow[];
  biggest_jump: PrizeRow[];
  people: PersonRow[];
  /** Everyone credited with at least one standard; `people` shows the first few. */
  people_total: number;
  /** Existing repos that reached all nine during the day; `first_nine` shows the first few. */
  finished: number;
  /** Repos made during the day, with their standards now. The organisers judge these. */
  new_repos: { name: string; url: string; met: number }[];
  /** Standards over the repos that existed at the start. `null` before the day. */
  standards: { start: number; now: number } | null;
  /** Per repo: the standards in place on the board now that were not there at the start. The board makes them glow. */
  fresh: Record<string, string[]>;
  /** How many existing repos could not be read and are left out. */
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
const isBot = (login: string | null): boolean => !login || login.endsWith("[bot]");
const NOTHING: Checks = evaluateStandards([], false);
const IDS = STANDARDS.map((s) => s.id);
const metIds = (c: Checks): string[] => IDS.filter((id) => c[id] === true);

/** One state of the default branch during the day: when GitHub put it there, who gets the credit, what was in place. */
export interface Step {
  at: string;
  login: string | null;
  checks: Checks;
  /** The tree SHA of this state: the grader's levels are kept per tree. */
  tree: string | null;
  /** For a merged pull request: when it was opened, and its page. */
  opened_at: string | null;
  url: string | null;
}

/** The default branch at the start, and every state it went through after the start, oldest first. */
export interface History {
  start: Checks;
  startTree: string | null;
  steps: Step[];
}

interface Seen {
  checks: Checks;
  tree: string | null;
}

// The nine answers and the tree SHA per commit or tree SHA. A SHA never changes, so an answer is kept once complete.
const shaChecks = new Map<string, Seen>();

/** The nine answers for one commit or tree SHA, and its tree SHA. `null` = no answer, or a standard that cannot be told. */
async function checksOf(name: string, sha: string, token: string, fetchImpl: Fetch): Promise<Seen | null> {
  if (ZERO_SHA.test(sha)) return { checks: NOTHING, tree: null };
  const kept = shaChecks.get(sha);
  if (kept) return kept;
  const res = await get(repoUrl(name, `git/trees/${sha}?recursive=1`), token, fetchImpl);
  const body = res.body as { sha?: string; tree?: { path: string; type: string; size?: number }[]; truncated?: boolean } | null;
  if (!body || !Array.isArray(body.tree)) return null;
  const files: TreeFile[] = body.tree.filter((e) => e.type === "blob").map((e) => ({ path: e.path, size: typeof e.size === "number" ? e.size : 0 }));
  const checks = evaluateStandards(files, !!body.truncated);
  if (!Object.values(checks).every((v) => v !== null)) return null;
  const seen = { checks, tree: typeof body.sha === "string" ? body.sha : sha };
  shaChecks.set(sha, seen);
  return seen;
}

interface Pull {
  login: string;
  opened_at: string | null;
  url: string | null;
}

/** Pull requests merged into the repo, by the SHA GitHub merged them as: author, when opened, its page. */
async function mergedPulls(name: string, token: string, fetchImpl: Fetch): Promise<Map<string, Pull>> {
  const res = await get(repoUrl(name, `pulls?state=closed&sort=updated&direction=desc&per_page=${PAGE}`), token, fetchImpl);
  const out = new Map<string, Pull>();
  if (!Array.isArray(res.body)) return out;
  for (const pr of res.body as { merged_at?: unknown; merge_commit_sha?: unknown; created_at?: unknown; html_url?: unknown; user?: { login?: unknown } }[]) {
    if (typeof pr.merged_at === "string" && typeof pr.merge_commit_sha === "string" && typeof pr.user?.login === "string") {
      out.set(pr.merge_commit_sha, {
        login: pr.user.login,
        opened_at: typeof pr.created_at === "string" ? pr.created_at : null,
        url: typeof pr.html_url === "string" ? pr.html_url : null,
      });
    }
  }
  return out;
}

interface Activity {
  before: string;
  after: string;
  ref: string;
  timestamp: string;
  activity_type: string;
  actor: string | null;
}

function toActivity(a: unknown): Activity | null {
  const x = a as { before?: unknown; after?: unknown; ref?: unknown; timestamp?: unknown; activity_type?: unknown; actor?: { login?: unknown } | null } | null;
  if (typeof x?.before !== "string" || typeof x.after !== "string" || typeof x.ref !== "string" || typeof x.timestamp !== "string") return null;
  return {
    before: x.before,
    after: x.after,
    ref: x.ref,
    timestamp: x.timestamp,
    activity_type: typeof x.activity_type === "string" ? x.activity_type : "push",
    actor: typeof x.actor?.login === "string" ? x.actor.login : null,
  };
}

/**
 * The history from GitHub's repository activity. `undefined` = the activity is not there to read (use the commits);
 * `null` = it could not be read now.
 */
async function activityHistory(repo: RepoStandards, branch: string, start: string, token: string, fetchImpl: Fetch): Promise<History | null | undefined> {
  const res = await get(repoUrl(repo.name, `activity?ref=${encodeURIComponent(branch)}&per_page=${PAGE}`), token, fetchImpl);
  if (NO_ACTIVITY.has(res.status)) return undefined;
  if (!Array.isArray(res.body)) return null;
  const all = res.body.map(toActivity).filter((a): a is Activity => a !== null && a.ref === `refs/heads/${branch}`);
  const day = all.filter((a) => a.timestamp > start).sort((a, b) => (a.timestamp < b.timestamp ? -1 : a.timestamp > b.timestamp ? 1 : 0));
  // a full page that does not reach back to the start may miss the first pushes of the day
  if (res.body.length >= PAGE && day.length === all.length) return null;
  if (day.length === 0) {
    return tally(repo.checks).unknown === 0 ? { start: repo.checks, startTree: repo.tree_sha ?? null, steps: [] } : null;
  }
  const pulls = day.some((a) => a.activity_type === "pr_merge") ? await mergedPulls(repo.name, token, fetchImpl) : new Map<string, Pull>();
  const first = await checksOf(repo.name, day[0].before, token, fetchImpl);
  if (!first) return null;
  const steps: Step[] = [];
  for (const a of day) {
    const seen = await checksOf(repo.name, a.after, token, fetchImpl);
    if (!seen) return null;
    const pr = a.activity_type === "pr_merge" ? pulls.get(a.after) : undefined;
    steps.push({ at: a.timestamp, login: pr?.login ?? a.actor, checks: seen.checks, tree: seen.tree, opened_at: pr?.opened_at ?? null, url: pr?.url ?? null });
  }
  return { start: first.checks, startTree: first.tree, steps };
}

interface Commit {
  sha: string;
  tree: string;
  date: string;
  parents: string[];
  author: string | null;
}

function toCommit(c: unknown): Commit | null {
  const x = c as {
    sha?: unknown;
    parents?: { sha?: unknown }[];
    author?: { login?: unknown } | null;
    commit?: { tree?: { sha?: unknown }; committer?: { date?: unknown } };
  } | null;
  const sha = x?.sha;
  const tree = x?.commit?.tree?.sha;
  const date = x?.commit?.committer?.date;
  const parents = Array.isArray(x?.parents) ? x.parents.map((p) => p?.sha).filter((p): p is string => typeof p === "string") : [];
  const author = typeof x?.author?.login === "string" ? x.author.login : null;
  return typeof sha === "string" && typeof tree === "string" && typeof date === "string" ? { sha, tree, date, parents, author } : null;
}

/**
 * The fallback: HEAD and its first parents back to the first commit at or before `start`, with commit dates. Following
 * first parents skips the commits of a merged branch, which were never on the default branch on their own.
 */
async function commitHistory(repo: RepoStandards, start: string, token: string, fetchImpl: Fetch): Promise<History | null> {
  const page = await get(repoUrl(repo.name, `commits?per_page=${PAGE}`), token, fetchImpl);
  if (page.status === EMPTY_REPO_STATUS) return { start: NOTHING, startTree: null, steps: [] };
  if (!Array.isArray(page.body) || page.body.length === 0) return null;
  const known = new Map<string, Commit>();
  for (const raw of page.body) {
    const c = toCommit(raw);
    if (c) known.set(c.sha, c);
  }
  let at: Commit | null = toCommit(page.body[0]);
  const chain: Commit[] = [];
  for (let step = 0; at; step++) {
    if (step >= PAGE * 3) return null;
    chain.push(at);
    if (at.date <= start || at.parents.length === 0) break;
    const parent: string = at.parents[0];
    let next = known.get(parent) ?? null;
    if (!next) {
      next = toCommit((await get(repoUrl(repo.name, `commits/${parent}`), token, fetchImpl)).body);
      if (!next) return null;
    }
    at = next;
  }
  const oldest = chain[chain.length - 1];
  const first: Seen | null = oldest && oldest.date <= start ? await checksOf(repo.name, oldest.tree, token, fetchImpl) : { checks: NOTHING, tree: null };
  if (!first) return null;
  const day = chain.filter((c) => c.date > start).reverse();
  const pulls = day.length > 0 ? await mergedPulls(repo.name, token, fetchImpl) : new Map<string, Pull>();
  const steps: Step[] = [];
  for (const c of day) {
    const seen = await checksOf(repo.name, c.tree, token, fetchImpl);
    if (!seen) return null;
    const pr = pulls.get(c.sha);
    steps.push({ at: c.date, login: pr?.login ?? c.author, checks: seen.checks, tree: seen.tree, opened_at: pr?.opened_at ?? null, url: pr?.url ?? null });
  }
  return { start: first.checks, startTree: first.tree, steps };
}

// The history of a repo is kept until it is pushed again.
const histories = new Map<string, { pushed_at: string | null; history: History }>();

/** Take over the histories another server instance already read (the shared snapshot), so they cost no call here. */
export function seedHistories(previous: Record<string, { pushed_at: string | null; history: History | null }>): void {
  for (const [name, kept] of Object.entries(previous)) {
    if (kept.history && !histories.has(name)) histories.set(name, { pushed_at: kept.pushed_at, history: kept.history });
  }
}

/** The default branch from the start onwards. A repo nobody pushed to since the start costs no call. `null` = not readable. */
export async function historyOf(repo: RepoStandards, start: string, token: string, fetchImpl: Fetch): Promise<History | null> {
  if (repo.pushed_at && repo.pushed_at <= start) {
    return tally(repo.checks).unknown === 0 ? { start: repo.checks, startTree: repo.tree_sha ?? null, steps: [] } : null;
  }
  const kept = histories.get(repo.name);
  if (kept && kept.pushed_at === repo.pushed_at) return kept.history;
  let history: History | null | undefined = repo.default_branch ? await activityHistory(repo, repo.default_branch, start, token, fetchImpl) : undefined;
  if (history === undefined) history = await commitHistory(repo, start, token, fetchImpl);
  if (history) histories.set(repo.name, { pushed_at: repo.pushed_at, history });
  return history;
}

interface Credit {
  login: string;
  id: string;
  at: string;
}

/** What one existing repo did during the day, up to `until`. */
function judge(repo: RepoStandards, h: History, until: string): { row: PrizeRow; credits: Credit[] } {
  const steps = h.steps.filter((s) => s.at <= until);
  const final = steps.length > 0 ? steps[steps.length - 1].checks : h.start;
  const before = tally(h.start).met;
  const after = tally(final).met;
  const total = IDS.length;

  const reached = before < total && after === total ? (steps.find((s) => tally(s.checks).complete)?.at ?? null) : null;
  const settled = after > before ? (steps.find((s) => tally(s.checks).met >= after)?.at ?? null) : null;

  // Each standard that is in place at the end and was not at the start goes to whoever brought it in first.
  const added = IDS.filter((id) => final[id] === true && h.start[id] !== true);
  const credits: Credit[] = [];
  for (const id of added) {
    let prev = h.start;
    for (const s of steps) {
      if (s.checks[id] === true && prev[id] !== true) {
        if (!isBot(s.login)) credits.push({ login: s.login!, id, at: s.at });
        break;
      }
      prev = s.checks;
    }
  }
  const count = new Map<string, number>();
  for (const c of credits) count.set(c.login, (count.get(c.login) ?? 0) + 1);
  const by = [...count.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([login]) => login);

  return {
    row: { name: repo.name, url: repo.url, before, after, jump: after - before, reached_at: reached, settled_at: settled, by, had: metIds(h.start), added },
    credits,
  };
}

const byTime = (a: string | null, b: string | null): number => (a === b ? 0 : a === null ? 1 : b === null ? -1 : a < b ? -1 : 1);

let memo: { at: number; value: Promise<PrizesPayload> } | null = null;

type Day = { start: string; end: string };

const phaseAt = (nowIso: string, day: Day): PrizesPayload["phase"] => (nowIso < day.start ? "before" : nowIso < day.end ? "during" : "after");

const emptyPayload = (phase: PrizesPayload["phase"], day: Day, computed_at: string | null): PrizesPayload => ({
  phase,
  start: day.start,
  end: day.end,
  computed_at,
  first_nine: [],
  closest: [],
  biggest_jump: [],
  people: [],
  people_total: 0,
  finished: 0,
  new_repos: [],
  standards: null,
  fresh: {},
  unread: 0,
});

async function compute(board: StandardsPayload, token: string, fetchImpl: Fetch, nowIso: string, day: Day): Promise<PrizesPayload> {
  const { start, end } = day;
  const phase = phaseAt(nowIso, day);
  if (phase === "before" || !board.repos) return emptyPayload(phase, day, board.repos ? nowIso : null);

  const until = phase === "after" ? end : nowIso;
  const existing = board.repos.filter((r) => !!r.created_at && r.created_at < start);
  const made = board.repos.filter((r) => !!r.created_at && r.created_at >= start);

  const judged = await mapLimited(existing, CONCURRENCY, async (repo) => {
    const h = await historyOf(repo, start, token, fetchImpl);
    return h ? { repo, h, ...judge(repo, h, until) } : null;
  });
  const read = judged.filter((j): j is NonNullable<typeof j> => j !== null);
  const rows = read.map((j) => j.row);

  const finishers = rows.filter((r) => r.reached_at !== null);
  const firstNine = [...finishers].sort((a, b) => byTime(a.reached_at, b.reached_at) || a.name.localeCompare(b.name)).slice(0, SHOWN);
  const closest = rows
    .filter((r) => r.after < IDS.length)
    .sort((a, b) => b.after - a.after || b.jump - a.jump || byTime(a.settled_at, b.settled_at) || a.name.localeCompare(b.name))
    .slice(0, 3);
  const biggest = rows
    .filter((r) => r.jump > 0)
    .sort((a, b) => b.jump - a.jump || byTime(a.settled_at, b.settled_at) || a.name.localeCompare(b.name))
    .slice(0, SHOWN);

  const people = new Map<string, PersonRow>();
  for (const j of read) {
    for (const c of j.credits) {
      const p = people.get(c.login) ?? { login: c.login, added: 0, repos: [], last_at: c.at };
      p.added++;
      if (!p.repos.includes(j.repo.name)) p.repos.push(j.repo.name);
      if (c.at > p.last_at) p.last_at = c.at;
      people.set(c.login, p);
    }
  }

  // The board shows the repos as they are now; what is in place now and was not at the start glows.
  const fresh: Record<string, string[]> = {};
  for (const j of read) {
    // SECURITY.md met by the foundation's policy is nobody's work today: it does not glow.
    const ids = IDS.filter((id) => j.repo.checks[id] === true && j.h.start[id] !== true && !(id === "security" && j.repo.security_by_org));
    if (ids.length > 0) fresh[j.repo.name] = ids;
  }
  for (const r of made) {
    const ids = metIds(r.checks);
    if (ids.length > 0) fresh[r.name] = ids;
  }

  return {
    ...emptyPayload(phase, day, nowIso),
    first_nine: firstNine,
    closest,
    biggest_jump: biggest,
    people: [...people.values()]
      .sort((a, b) => b.added - a.added || byTime(a.last_at, b.last_at) || a.login.localeCompare(b.login))
      .slice(0, PEOPLE_SHOWN),
    people_total: people.size,
    finished: finishers.length,
    new_repos: made
      .map((r) => ({ name: r.name, url: r.url, met: tally(r.checks).met }))
      .sort((a, b) => b.met - a.met || a.name.localeCompare(b.name)),
    standards: { start: rows.reduce((n, r) => n + r.before, 0), now: rows.reduce((n, r) => n + r.after, 0) },
    fresh,
    unread: existing.length - read.length,
  };
}

/** The leaderboard, from the board's data and GitHub's history. Never throws; worked out at most once a minute per instance. */
export async function loadPrizes(
  board: StandardsPayload,
  fetchImpl: Fetch = fetch,
  token: string | undefined = process.env.GITHUB_PAT,
  now: () => number = Date.now,
  day: Day = HARDENING_DAY,
): Promise<PrizesPayload> {
  const nowIso = new Date(now()).toISOString();
  const fallback = emptyPayload(phaseAt(nowIso, day), day, null);
  if (!token) return fallback;
  if (memo && now() - memo.at < TTL_SECONDS * 1000) return memo.value;
  const entry = { at: now(), value: compute(board, token, fetchImpl, nowIso, day).catch(() => fallback) };
  memo = entry;
  return entry.value;
}

/** For tests: forget everything that is kept. */
export function resetPrizesMemo(): void {
  memo = null;
  shaChecks.clear();
  histories.clear();
}
