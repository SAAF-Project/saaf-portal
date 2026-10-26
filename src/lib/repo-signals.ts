import { reposToInspect, type RepoSignal, type RepoSignals } from "../components/temple/liveAlerts";

// Repo state for the live alerts of the /progress visual (see components/temple/liveAlerts.ts for the rules).
// One paged call lists every repo of the organisation (existence, archived, last push); for the repos of agents that
// claim to be Ready or further one git-tree call looks for AUDIT-CRITERIA.md and tests. All of it is cached like the
// repo list. If GitHub does not answer, the page simply has no live alerts: missing data is never an alert.

const ORG = "SAAF-Project";
const API = "https://api.github.com";
const REVALIDATE_SECONDS = 600;
const CONCURRENCY = 6;

const TEST_PATH = /(^|\/)(tests?|__tests__|spec)\/|(^|\/)test_[^/]+\.py$|_test\.(py|go)$|\.(test|spec)\.[cm]?[jt]sx?$/i;
const SKIPPED_PATH = /(^|\/)(node_modules|vendor|\.venv|venv|site-packages)\//;

/** What a repo's file list says. `null` = cannot tell (the list was cut off, or there is no list). */
export function inspectTree(paths: string[], truncated: boolean): Pick<RepoSignal, "hasAuditCriteria" | "hasTests"> {
  const files = paths.filter((p) => !SKIPPED_PATH.test(p));
  const hasAuditCriteria = files.includes("AUDIT-CRITERIA.md") ? true : truncated ? null : false;
  const hasTests = files.some((p) => TEST_PATH.test(p)) ? true : truncated ? null : false;
  return { hasAuditCriteria, hasTests };
}

type Fetch = typeof fetch;

async function getJson(url: string, token: string, fetchImpl: Fetch): Promise<unknown | null> {
  try {
    const res = await fetchImpl(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
      next: { revalidate: REVALIDATE_SECONDS },
    });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

async function listOrgRepos(token: string, fetchImpl: Fetch): Promise<Pick<RepoSignal, "name" | "archived" | "pushedAt">[] | null> {
  const repos: Pick<RepoSignal, "name" | "archived" | "pushedAt">[] = [];
  for (let page = 1; page <= 10; page++) {
    const data = await getJson(`${API}/orgs/${ORG}/repos?per_page=100&page=${page}`, token, fetchImpl);
    if (!Array.isArray(data)) return null; // a half-read list would make real repos look missing
    for (const r of data) repos.push({ name: String(r.name), archived: !!r.archived, pushedAt: typeof r.pushed_at === "string" ? r.pushed_at : null });
    if (data.length < 100) return repos;
  }
  return null;
}

async function inspectRepo(name: string, token: string, fetchImpl: Fetch) {
  const tree = (await getJson(`${API}/repos/${ORG}/${name}/git/trees/HEAD?recursive=1`, token, fetchImpl)) as { tree?: { path: string; type: string }[]; truncated?: boolean } | null;
  if (!tree || !Array.isArray(tree.tree)) return { hasAuditCriteria: null, hasTests: null };
  return inspectTree(tree.tree.filter((e) => e.type === "blob").map((e) => e.path), !!tree.truncated);
}

/** Runs `fn` over `items`, at most `limit` at a time. */
async function mapLimited<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    }),
  );
  return out;
}

async function fetchRepoSignals(plans: Parameters<typeof reposToInspect>[0], fetchImpl: Fetch, token: string): Promise<RepoSignals | null> {
  const listed = await listOrgRepos(token, fetchImpl);
  if (!listed) return null;

  const repos: Record<string, RepoSignal> = {};
  for (const r of listed) repos[r.name.toLowerCase()] = { ...r, hasAuditCriteria: null, hasTests: null };

  // the organisation's own spelling of each name, once per repo, only for repos that exist and are not archived
  const wanted = [...new Set(reposToInspect(plans).map((n) => n.toLowerCase()))].filter((key) => repos[key] && !repos[key].archived);
  const inspected = await mapLimited(wanted, CONCURRENCY, (key) => inspectRepo(repos[key].name, token, fetchImpl));
  wanted.forEach((key, i) => Object.assign(repos[key], inspected[i]));

  return { listed: true, repos, checked_at: new Date().toISOString() };
}

// The fetches above are cached by Next, but a big repo's file list is over the 2 MB limit of that cache and would be
// fetched on every page load. So the finished result (a few KB) is kept here as well, per server instance, and shared
// by visitors who arrive at the same time. A failure is kept for a minute only, so a hiccup heals quickly.
const FAILURE_TTL_MS = 60_000;
let memo: { key: string; at: number; ttl: number; value: Promise<RepoSignals | null> } | null = null;

export async function loadRepoSignals(
  plans: Parameters<typeof reposToInspect>[0],
  fetchImpl: Fetch = fetch,
  token: string | undefined = process.env.GITHUB_PAT,
  now: () => number = Date.now,
): Promise<RepoSignals | null> {
  if (!token) return null;
  const key = reposToInspect(plans).map((n) => n.toLowerCase()).sort().join(",");
  if (memo && memo.key === key && now() - memo.at < memo.ttl) return memo.value;
  const entry = { key, at: now(), ttl: REVALIDATE_SECONDS * 1000, value: fetchRepoSignals(plans, fetchImpl, token) };
  memo = entry;
  const value = await entry.value;
  if (!value) entry.ttl = FAILURE_TTL_MS;
  return value;
}

/** For tests: forget the kept result. */
export function resetRepoSignalsMemo(): void {
  memo = null;
}
