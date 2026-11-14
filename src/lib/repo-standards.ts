import { evaluateStandards, type Checks, type TreeFile } from "../components/temple/standards/standards";
import { META_REPOS } from "./github";
import { mapLimited } from "./repo-signals";

// The standards board (/standards): the nine standards of components/temple/standards/standards.ts, checked for every
// repo of the organisation that is not archived, not a meta repo and not a dot repo. A sibling of repo-signals.ts.
//
// One paged call lists the repos; one git-tree call per repo answers all nine standards. A repo's answer is kept until
// its `pushed_at` changes, so a refresh costs the list call plus one tree call per repo pushed since the last look.
// The finished result is kept for a minute per server instance and shared by everyone who has the board open.
// These calls skip the Next fetch cache (`no-store`): its ten minutes would hide a merge.
//
// Missing data is never shown as a missing standard. No file list, or a cut-off one: "not checked" (null), asked again
// at the next refresh. No repo list: the last good result, marked stale. The board reads the default branch only.
// A repo without a single commit answers 409 to the tree call: nothing is in place there, and that answer is kept like
// any other. The `size` field of the repo list is not used for this: GitHub reports 0 for some repos that do have files.

const ORG = "SAAF-Project";
const API = "https://api.github.com";
const TTL_SECONDS = 60;
const CONCURRENCY = 6;
/** GitHub's answer to a tree call on a repo without a single commit ("Git Repository is empty"). */
const EMPTY_REPO_STATUS = 409;

export interface RepoStandards {
  name: string;
  url: string;
  private: boolean;
  pushed_at: string | null;
  checks: Checks;
}

export interface StandardsPayload {
  /** When GitHub last answered the repo list. `null` = never. */
  checked_at: string | null;
  /** True when the last refresh got no repo list and this is the result of an earlier one. */
  stale: boolean;
  ttl_seconds: number;
  /** In alphabetical order. `null` = no answer from GitHub yet (or no token). */
  repos: RepoStandards[] | null;
  /** How many repos are left off the board because they are archived. */
  archived: number | null;
}

type Fetch = typeof fetch;
type Listed = Omit<RepoStandards, "checks"> & { archived: boolean };

const NO_ANSWER: StandardsPayload = { checked_at: null, stale: false, ttl_seconds: TTL_SECONDS, repos: null, archived: null };

async function get(url: string, token: string, fetchImpl: Fetch): Promise<{ ok: boolean; status: number; body: unknown }> {
  try {
    const res = await fetchImpl(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
      cache: "no-store",
    });
    return { ok: res.ok, status: res.status, body: res.ok ? await res.json() : null };
  } catch {
    return { ok: false, status: 0, body: null };
  }
}

async function listRepos(token: string, fetchImpl: Fetch): Promise<Listed[] | null> {
  const repos: Listed[] = [];
  for (let page = 1; page <= 10; page++) {
    const { body } = await get(`${API}/orgs/${ORG}/repos?per_page=100&page=${page}`, token, fetchImpl);
    if (!Array.isArray(body)) return null; // a half-read list would make real repos drop off the board
    for (const r of body) {
      const name = String(r.name);
      repos.push({
        name,
        url: typeof r.html_url === "string" ? r.html_url : `https://github.com/${ORG}/${name}`,
        private: !!r.private,
        archived: !!r.archived,
        pushed_at: typeof r.pushed_at === "string" ? r.pushed_at : null,
      });
    }
    if (body.length < 100) return repos;
  }
  return null;
}

/** The nine answers for one repo, from one call. All `null` when GitHub does not give a file list. */
async function checkRepo(name: string, token: string, fetchImpl: Fetch): Promise<Checks> {
  const res = await get(`${API}/repos/${ORG}/${encodeURIComponent(name)}/git/trees/HEAD?recursive=1`, token, fetchImpl);
  if (res.status === EMPTY_REPO_STATUS) return evaluateStandards([], false); // no commits: nothing is in place, and that is certain
  const tree = res.body as { tree?: { path: string; type: string; size?: number }[]; truncated?: boolean } | null;
  if (!tree || !Array.isArray(tree.tree)) return evaluateStandards([], true);
  const files: TreeFile[] = tree.tree.filter((e) => e.type === "blob").map((e) => ({ path: e.path, size: typeof e.size === "number" ? e.size : 0 }));
  return evaluateStandards(files, !!tree.truncated);
}

const settled = (checks: Checks): boolean => Object.values(checks).every((v) => v !== null);
const byName = (a: { name: string }, b: { name: string }): number => {
  const x = a.name.toLowerCase();
  const y = b.name.toLowerCase();
  return x < y ? -1 : x > y ? 1 : a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
};

// Kept per server instance: the answers per repo (only complete ones, so a failed or cut-off check is asked again), the
// last result built from a real repo list, and the result of the last minute.
const answers = new Map<string, { pushed_at: string | null; checks: Checks }>();
let lastGood: StandardsPayload | null = null;
let memo: { at: number; value: Promise<StandardsPayload> } | null = null;

async function refresh(fetchImpl: Fetch, token: string, now: () => number): Promise<StandardsPayload> {
  const listed = await listRepos(token, fetchImpl);
  if (!listed) return lastGood ? { ...lastGood, stale: true } : NO_ANSWER;

  const candidates = listed.filter((r) => !META_REPOS.has(r.name) && !r.name.startsWith("."));
  const live = candidates.filter((r) => !r.archived).sort(byName);

  const checks = await mapLimited(live, CONCURRENCY, async (r) => {
    const kept = answers.get(r.name);
    if (kept && kept.pushed_at === r.pushed_at) return kept.checks;
    const fresh = await checkRepo(r.name, token, fetchImpl);
    if (settled(fresh)) answers.set(r.name, { pushed_at: r.pushed_at, checks: fresh });
    else answers.delete(r.name);
    return fresh;
  });

  const names = new Set(live.map((r) => r.name));
  for (const name of [...answers.keys()]) if (!names.has(name)) answers.delete(name);

  lastGood = {
    checked_at: new Date(now()).toISOString(),
    stale: false,
    ttl_seconds: TTL_SECONDS,
    repos: live.map((r, i) => ({ name: r.name, url: r.url, private: r.private, pushed_at: r.pushed_at, checks: checks[i] })),
    archived: candidates.length - live.length,
  };
  return lastGood;
}

/** The board's data. Never throws; asks GitHub at most once a minute, however many people have the board open. */
export async function loadRepoStandards(
  fetchImpl: Fetch = fetch,
  token: string | undefined = process.env.GITHUB_PAT,
  now: () => number = Date.now,
): Promise<StandardsPayload> {
  if (!token) return NO_ANSWER;
  if (memo && now() - memo.at < TTL_SECONDS * 1000) return memo.value;
  const entry = {
    at: now(),
    value: refresh(fetchImpl, token, now).catch(() => (lastGood ? { ...lastGood, stale: true } : NO_ANSWER)),
  };
  memo = entry;
  return entry.value;
}

/** For tests: forget everything that is kept. */
export function resetRepoStandardsMemo(): void {
  memo = null;
  lastGood = null;
  answers.clear();
}
