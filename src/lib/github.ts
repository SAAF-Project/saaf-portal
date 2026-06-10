import { readFileSync } from "fs";
import { join } from "path";

const GITHUB_PAT = process.env.GITHUB_PAT!;
const API = "https://api.github.com";
const ORG = "SAAF-Project";
const REPO = "SAAF-Project/SAAF-Project";

// Repos that aren't agents (meta repos)
const META_REPOS = new Set(["saaf-portal", "SAAF-Project", "website"]);

export interface ReviewedAgent {
  category: string;
  tags?: string[];
  quality: {
    hasTests: boolean;
    testCount?: number;
    hasSamples: boolean;
    notes?: string;
  };
}

// Reviewed-agent metadata drives the agent-library "reviewed" badge AND the
// leaderboard's Agent Builder bonus. Source of truth: public/data/agent-reviews.json
// (records with verdict:"reviewed"). Kept as versioned data — not a hardcoded
// const — so the full review log is reusable (UI, leaderboard, saaf-pr-review skill).
interface AgentReviewRecord extends ReviewedAgent {
  repo: string;
  verdict: string;
}

let reviewedCache: Record<string, ReviewedAgent> | null = null;

export function getReviewedAgents(): Record<string, ReviewedAgent> {
  if (reviewedCache) return reviewedCache;
  const map: Record<string, ReviewedAgent> = {};
  try {
    const raw = readFileSync(
      join(process.cwd(), "public", "data", "agent-reviews.json"),
      "utf-8"
    );
    const data = JSON.parse(raw) as { reviews: AgentReviewRecord[] };
    for (const r of data.reviews) {
      if (r.verdict !== "reviewed") continue;
      map[r.repo] = { category: r.category, tags: r.tags, quality: r.quality };
    }
  } catch {
    // Missing/invalid file → no reviewed agents (keeps build & runtime green).
  }
  reviewedCache = map;
  return map;
}

// Cache TTLs in seconds — tuned per endpoint type
export const CACHE_TTL = {
  REPOS_LIST: 600,        // 10 min  — repo list rarely changes
  README: 3600,           // 1 hour  — READMEs change infrequently
  CONTRIBUTORS: 1800,     // 30 min  — contributors change slowly
  PRS_CLOSED: 120,        // 2 min   — leaderboard wants near-real-time
  PR_FILES: 86400,        // 1 day   — immutable after merge
  USER_LOOKUP: 86400,     // 1 day   — user IDs are immutable
  ORG_MEMBER: 300,        // 5 min   — quick reflect new joins
  SEARCH: 300,            // 5 min   — search results
};

async function githubFetch(
  url: string,
  opts?: { revalidate?: number; accept?: string }
): Promise<Response> {
  return fetch(url, {
    headers: {
      Authorization: `Bearer ${GITHUB_PAT}`,
      Accept: opts?.accept || "application/vnd.github+json",
    },
    next: opts?.revalidate !== undefined ? { revalidate: opts.revalidate } : undefined,
  });
}

export type AgentStatus = "reviewed" | "work-in-progress" | "needs-readme" | "not-reviewed";

export interface AgentRepo {
  name: string;
  description: string | null;
  language: string | null;
  updatedAt: string;
  pushedAt: string;
  htmlUrl: string;
  stars: number;
  isPrivate: boolean;
  readmeExcerpt: string | null;
  readmeSize: number;
  status: AgentStatus;
  category: string | null;
  tags: string[];
  quality: ReviewedAgent["quality"] | null;
  recentlyUpdated: boolean;
}

const README_QUALITY_THRESHOLD = 200;

// Single source of truth for an agent repo's review status. Reviewed agents
// (allowlist) always rank highest; otherwise status is derived from README size.
function computeStatus(
  readmeSize: number,
  reviewed: ReviewedAgent | undefined
): AgentStatus {
  if (reviewed) return "reviewed";
  if (readmeSize === 0) return "needs-readme";
  if (readmeSize < README_QUALITY_THRESHOLD) return "work-in-progress";
  return "not-reviewed";
}

// A repo only earns the Agent Builder leaderboard bonus if it clears the quality
// gate: a real README (reviewed agents always qualify). WIP / missing-README
// repos earn nothing — this is the anti-gaming gate.
function qualifiesForBonus(status: AgentStatus): boolean {
  return status === "reviewed" || status === "not-reviewed";
}

function isBotLogin(login: string): boolean {
  return /\[bot\]$/i.test(login);
}

// Logins excluded from Agent Builder attribution. Organisers/maintainers don't
// compete for the bonus, and — more importantly — their central-repo commit
// history bleeds into agent repos that were copied/forked from the main repo
// (e.g. Track-2---IAM-final inherited MSACC's main-repo commits), which would
// otherwise credit them for agents they didn't build.
const AGENT_ATTRIBUTION_EXCLUDE = new Set(["msacc"]);

function isExcludedFromAgentAttribution(login: string): boolean {
  return isBotLogin(login) || AGENT_ATTRIBUTION_EXCLUDE.has(login.toLowerCase());
}

const MANIFEST_FILES = new Set([
  "requirements.txt",
  "pyproject.toml",
  "package.json",
  "go.mod",
  "setup.py",
  "setup.cfg",
  "pipfile",
  "cargo.toml",
  "gemfile",
  "build.gradle",
  "pom.xml",
]);
const CODE_EXT = /\.(py|ts|tsx|js|jsx|go|rb|java|rs|cs|php|ipynb|cpp|c|kt|swift)$/i;
const CODE_BYTES_FLOOR = 15000; // manifest-less repos need real code volume to count

const repoCodeCache = new Map<string, { has: boolean; ts: number }>();
const REPO_CODE_TTL = 10 * 60 * 1000;

// Stricter scoring gate: a non-reviewed repo must contain real code — a
// dependency manifest OR a meaningful volume of code files — so a big README on
// an empty stub (e.g. UC3) cannot earn the Agent Builder base bonus. Reviewed
// repos bypass this (already vetted). One cached tree call per repo.
async function repoHasCode(repoName: string): Promise<boolean> {
  const cached = repoCodeCache.get(repoName);
  if (cached && Date.now() - cached.ts < REPO_CODE_TTL) return cached.has;

  let has = false;
  try {
    const repoRes = await githubFetch(`${API}/repos/${ORG}/${repoName}`, {
      revalidate: CACHE_TTL.REPOS_LIST,
    });
    const meta = repoRes.ok ? await repoRes.json() : null;
    const branch = meta?.default_branch || "main";
    const treeRes = await githubFetch(
      `${API}/repos/${ORG}/${repoName}/git/trees/${branch}?recursive=1`,
      { revalidate: CACHE_TTL.REPOS_LIST }
    );
    if (treeRes.ok) {
      const tree = await treeRes.json();
      if (Array.isArray(tree?.tree)) {
        let codeBytes = 0;
        for (const t of tree.tree) {
          if (t.type !== "blob" || typeof t.path !== "string") continue;
          const base = t.path.split("/").pop()!.toLowerCase();
          if (MANIFEST_FILES.has(base)) {
            has = true;
            break;
          }
          if (CODE_EXT.test(t.path)) {
            codeBytes += typeof t.size === "number" ? t.size : 0;
          }
        }
        if (!has && codeBytes >= CODE_BYTES_FLOOR) has = true;
      }
    }
  } catch {}

  repoCodeCache.set(repoName, { has, ts: Date.now() });
  return has;
}

export async function fetchAgentLibrary(): Promise<AgentRepo[]> {
  const repos: AgentRepo[] = [];
  let page = 1;

  while (true) {
    const res = await githubFetch(
      `${API}/orgs/${ORG}/repos?per_page=100&page=${page}&sort=pushed`,
      { revalidate: CACHE_TTL.REPOS_LIST }
    );
    if (!res.ok) break;
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) break;

    for (const repo of data) {
      if (META_REPOS.has(repo.name) || repo.archived) continue;

      const reviewed = getReviewedAgents()[repo.name];

      // Fetch README
      let readmeExcerpt: string | null = null;
      let readmeSize = 0;
      try {
        const readmeRes = await githubFetch(
          `${API}/repos/${ORG}/${repo.name}/readme`,
          { accept: "application/vnd.github.raw+json", revalidate: CACHE_TTL.README }
        );
        if (readmeRes.ok) {
          const text = await readmeRes.text();
          readmeSize = text.length;
          readmeExcerpt = extractExcerpt(text);
        }
      } catch {}

      // Determine status
      const status = computeStatus(readmeSize, reviewed);

      // Recently updated = pushed in last 60 days
      const daysSincePush =
        (Date.now() - new Date(repo.pushed_at).getTime()) / (1000 * 60 * 60 * 24);
      const recentlyUpdated = daysSincePush <= 60;

      repos.push({
        name: repo.name,
        description: repo.description,
        language: repo.language,
        updatedAt: repo.updated_at,
        pushedAt: repo.pushed_at,
        htmlUrl: repo.html_url,
        stars: repo.stargazers_count,
        isPrivate: repo.private,
        readmeExcerpt,
        readmeSize,
        status,
        category: reviewed?.category || null,
        tags: reviewed?.tags || [],
        quality: reviewed?.quality || null,
        recentlyUpdated,
      });
    }

    if (data.length < 100) break;
    page++;
  }

  // Sort: reviewed first, then by pushedAt desc
  return repos.sort((a, b) => {
    const order: Record<AgentStatus, number> = {
      reviewed: 0,
      "not-reviewed": 1,
      "work-in-progress": 2,
      "needs-readme": 3,
    };
    if (order[a.status] !== order[b.status]) {
      return order[a.status] - order[b.status];
    }
    return new Date(b.pushedAt).getTime() - new Date(a.pushedAt).getTime();
  });
}

function extractExcerpt(markdown: string, maxChars = 400): string {
  let text = markdown
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/^---[\s\S]*?---\n/m, "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/!\[.*?\]\(.*?\)/g, "")
    .replace(/\[!\[.*?\]\(.*?\)\]\(.*?\)/g, "");

  text = text.replace(/^#\s+.*$/m, "").trim();

  const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim().length > 30);
  let excerpt = paragraphs[0] || "";

  excerpt = excerpt
    .replace(/^#+\s*/gm, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[(.+?)\]\(.+?\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();

  if (excerpt.length > maxChars) {
    excerpt = excerpt.slice(0, maxChars).replace(/\s+\S*$/, "") + "…";
  }

  return excerpt || "";
}

export interface AgentContributionRepo {
  name: string;
  status: AgentStatus;
  reviewed: boolean;
}

export interface AgentContribution {
  repos: AgentContributionRepo[];
  linesChanged: number;
}

// login -> their qualifying agent-repo contributions across the org
export type AgentContributions = Record<string, AgentContribution>;

// Scans every non-meta, non-archived org repo that clears the README quality
// gate, and attributes to each contributor (via GitHub's stats/contributors
// endpoint) the repos they committed to plus their total lines changed
// (additions + deletions). Feeds the leaderboard's Agent Builder bonus.
// Bots are excluded. Lines-changed is intentionally noisy (includes generated
// files) but the consumer hard-caps it, so accuracy isn't critical here.
export async function fetchAgentContributions(): Promise<AgentContributions> {
  const result: AgentContributions = {};
  let page = 1;

  while (true) {
    const res = await githubFetch(
      `${API}/orgs/${ORG}/repos?per_page=100&page=${page}&sort=pushed`,
      { revalidate: CACHE_TTL.REPOS_LIST }
    );
    if (!res.ok) break;
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) break;

    for (const repo of data) {
      if (META_REPOS.has(repo.name) || repo.archived) continue;
      const reviewed = getReviewedAgents()[repo.name];

      // Quality gate — fetch README size only (not the full excerpt).
      let readmeSize = 0;
      try {
        const readmeRes = await githubFetch(
          `${API}/repos/${ORG}/${repo.name}/readme`,
          {
            accept: "application/vnd.github.raw+json",
            revalidate: CACHE_TTL.README,
          }
        );
        if (readmeRes.ok) readmeSize = (await readmeRes.text()).length;
      } catch {}

      const status = computeStatus(readmeSize, reviewed);
      if (!qualifiesForBonus(status)) continue;
      const isReviewed = status === "reviewed";

      // Non-reviewed repos must also contain real code (manifest or code
      // volume) — closes the "big README on an empty stub" gap. Reviewed repos
      // are already vetted and skip this extra call.
      if (!isReviewed && !(await repoHasCode(repo.name))) continue;

      // Attribution via the reliable /contributors endpoint (200, never 202).
      // This drives the base + reviewed bonus, so it must not depend on the
      // flaky stats endpoint below.
      const contribRes = await githubFetch(
        `${API}/repos/${ORG}/${repo.name}/contributors?per_page=100`,
        { revalidate: CACHE_TTL.CONTRIBUTORS }
      );
      let contributors: unknown;
      try {
        contributors = contribRes.ok ? await contribRes.json() : null;
      } catch {
        contributors = null;
      }
      if (!Array.isArray(contributors) || contributors.length === 0) continue;

      // Best-effort lines-changed via the stats endpoint. GitHub returns 202
      // while it (re)computes — in that case volume degrades to 0 for this
      // load (the base/reviewed bonus still applies); the Next fetch cache
      // fills it in on a later request.
      const linesByLogin: Record<string, number> = {};
      const statsRes = await githubFetch(
        `${API}/repos/${ORG}/${repo.name}/stats/contributors`,
        { revalidate: CACHE_TTL.CONTRIBUTORS }
      );
      if (statsRes.ok && statsRes.status !== 202) {
        try {
          const stats = await statsRes.json();
          if (Array.isArray(stats)) {
            for (const s of stats) {
              const l: string | undefined = s?.author?.login;
              if (!l) continue;
              linesByLogin[l] = Array.isArray(s.weeks)
                ? s.weeks.reduce(
                    (sum: number, w: { a?: number; d?: number }) =>
                      sum + (w.a || 0) + (w.d || 0),
                    0
                  )
                : 0;
            }
          }
        } catch {}
      }

      for (const c of contributors) {
        const login: string | undefined = c?.login;
        if (!login || isExcludedFromAgentAttribution(login)) continue;
        if (!result[login]) result[login] = { repos: [], linesChanged: 0 };
        result[login].repos.push({
          name: repo.name,
          status,
          reviewed: isReviewed,
        });
        result[login].linesChanged += linesByLogin[login] || 0;
      }
    }

    if (data.length < 100) break;
    page++;
  }

  return result;
}

export async function isOrgMember(username: string): Promise<boolean> {
  const res = await githubFetch(`${API}/orgs/${ORG}/members/${username}`, {
    revalidate: CACHE_TTL.ORG_MEMBER,
  });
  return res.status === 204;
}

export async function fetchMergedPRs(): Promise<PRCache> {
  const cache: PRCache = {};
  let page = 1;

  while (true) {
    const res = await githubFetch(
      `${API}/repos/${REPO}/pulls?state=closed&per_page=100&page=${page}`,
      { revalidate: CACHE_TTL.PRS_CLOSED }
    );
    const prs = await res.json();
    if (!Array.isArray(prs) || prs.length === 0) break;

    const merged = prs.filter(
      (pr: { merged_at: string | null }) => pr.merged_at
    );

    const fileResults = await Promise.allSettled(
      merged.map(async (pr: GitHubPR) => {
        const filesRes = await githubFetch(
          `${API}/repos/${REPO}/pulls/${pr.number}/files`,
          { revalidate: CACHE_TTL.PR_FILES }
        );
        const files = await filesRes.json();
        return {
          pr,
          files: Array.isArray(files)
            ? files.map((f: GitHubFile) => ({
                filename: f.filename,
                status: f.status,
              }))
            : [],
        };
      })
    );

    for (const r of fileResults) {
      if (r.status !== "fulfilled") continue;
      const { pr, files } = r.value;
      cache[pr.number] = {
        author: pr.user?.login || "unknown",
        merged_at: pr.merged_at!,
        title: pr.title,
        url: pr.html_url,
        files,
      };
    }

    if (prs.length < 100 || page > 50) break;
    page++;
  }

  return cache;
}

// Per-user in-memory cache for My Repos (10 min TTL).
// Survives warm container starts, reduces GitHub API load during hackathon.
const userReposCache = new Map<string, { data: OrgRepo[]; ts: number }>();
const USER_REPOS_TTL = 10 * 60 * 1000;

export async function fetchUserOrgRepos(username: string): Promise<OrgRepo[]> {
  const cached = userReposCache.get(username);
  if (cached && Date.now() - cached.ts < USER_REPOS_TTL) {
    return cached.data;
  }

  const repos: OrgRepo[] = [];
  let page = 1;
  const usernameLower = username.toLowerCase();

  async function safeJson(res: Response): Promise<unknown> {
    if (!res.ok || res.status === 204) return null;
    const text = await res.text();
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  }

  while (true) {
    const res = await githubFetch(
      `${API}/orgs/${ORG}/repos?per_page=100&page=${page}&sort=updated`,
      { revalidate: CACHE_TTL.REPOS_LIST }
    );
    const data = await safeJson(res);
    if (!Array.isArray(data) || data.length === 0) break;

    for (const repo of data) {
      let contributed = false;
      let prCount = 0;

      const contribRes = await githubFetch(
        `${API}/repos/${ORG}/${repo.name}/contributors?per_page=100`,
        { revalidate: CACHE_TTL.CONTRIBUTORS }
      );
      const contributors = await safeJson(contribRes);
      if (
        Array.isArray(contributors) &&
        contributors.some((c: { login: string }) => c.login?.toLowerCase() === usernameLower)
      ) {
        contributed = true;
      }

      if (!contributed) {
        const prRes = await githubFetch(
          `${API}/search/issues?q=repo:${ORG}/${repo.name}+author:${username}+type:pr&per_page=1`,
          { revalidate: CACHE_TTL.SEARCH }
        );
        const prData = await safeJson(prRes);
        if (prData && typeof prData === "object" && "total_count" in prData) {
          const tc = (prData as { total_count: number }).total_count;
          if (tc > 0) {
            contributed = true;
            prCount = tc;
          }
        }
      }

      if (contributed) {
        repos.push({
          name: repo.name,
          description: repo.description,
          language: repo.language,
          updated_at: repo.updated_at,
          html_url: repo.html_url,
          stargazers_count: repo.stargazers_count,
          fork: repo.fork,
          prCount,
        });
      }
    }

    if (data.length < 100) break;
    page++;
  }

  userReposCache.set(username, { data: repos, ts: Date.now() });
  return repos;
}

interface GitHubPR {
  number: number;
  title: string;
  html_url: string;
  merged_at: string | null;
  user?: { login: string };
}

interface GitHubFile {
  filename: string;
  status: string;
}

export interface PRCacheEntry {
  author: string;
  merged_at: string;
  title: string;
  url: string;
  files: { filename: string; status: string }[];
}

export type PRCache = Record<number, PRCacheEntry>;

export interface OrgRepo {
  name: string;
  description: string | null;
  language: string | null;
  updated_at: string;
  html_url: string;
  stargazers_count: number;
  fork: boolean;
  prCount?: number;
}
