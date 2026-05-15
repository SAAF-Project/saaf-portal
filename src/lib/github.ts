const GITHUB_PAT = process.env.GITHUB_PAT!;
const API = "https://api.github.com";
const ORG = "SAAF-Project";
const REPO = "SAAF-Project/SAAF-Project";

// Repos that aren't agents (meta repos)
const META_REPOS = new Set(["saaf-portal", "SAAF-Project", "website"]);

// Allowlist: repos approved for the Agent Library.
// To add a repo: verify its README is meaningful, agent works as described,
// and it's something the community can learn from. Then add the repo name here.
// Optionally tag with categories for filtering.
export const AGENT_LIBRARY_ALLOWLIST: Record<string, { category: string; tags?: string[] }> = {
  // Add manually after review, e.g.:
  // "GDPR-AI-Audit-Agent": { category: "Compliance", tags: ["GDPR", "DPIA"] },
};

async function githubFetch(url: string, acceptOverride?: string): Promise<Response> {
  return fetch(url, {
    headers: {
      Authorization: `Bearer ${GITHUB_PAT}`,
      Accept: acceptOverride || "application/vnd.github+json",
    },
  });
}

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
  category: string;
  tags: string[];
}

export async function fetchAgentLibrary(): Promise<AgentRepo[]> {
  const repos: AgentRepo[] = [];
  const allowedNames = Object.keys(AGENT_LIBRARY_ALLOWLIST);
  if (allowedNames.length === 0) return repos;

  for (const name of allowedNames) {
    const meta = AGENT_LIBRARY_ALLOWLIST[name];
    try {
      const repoRes = await githubFetch(`${API}/repos/${ORG}/${name}`);
      if (!repoRes.ok) continue;
      const repo = await repoRes.json();
      if (META_REPOS.has(repo.name) || repo.archived) continue;

      let readmeExcerpt: string | null = null;
      try {
        const readmeRes = await githubFetch(
          `${API}/repos/${ORG}/${name}/readme`,
          "application/vnd.github.raw+json"
        );
        if (readmeRes.ok) {
          const text = await readmeRes.text();
          readmeExcerpt = extractExcerpt(text);
        }
      } catch {}

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
        category: meta.category,
        tags: meta.tags || [],
      });
    } catch {}
  }

  return repos.sort((a, b) => new Date(b.pushedAt).getTime() - new Date(a.pushedAt).getTime());
}

function extractExcerpt(markdown: string, maxChars = 400): string {
  // Remove HTML comments, badges (image links), code blocks, and frontmatter
  let text = markdown
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/^---[\s\S]*?---\n/m, "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/!\[.*?\]\(.*?\)/g, "")
    .replace(/\[!\[.*?\]\(.*?\)\]\(.*?\)/g, "");

  // Skip leading H1 title
  text = text.replace(/^#\s+.*$/m, "").trim();

  // Take first paragraph after the title — usually the description
  const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim().length > 30);
  let excerpt = paragraphs[0] || "";

  // Strip remaining markdown
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

export async function isOrgMember(username: string): Promise<boolean> {
  const res = await githubFetch(
    `${API}/orgs/${ORG}/members/${username}`
  );
  return res.status === 204;
}

export async function fetchMergedPRs(): Promise<PRCache> {
  const cache: PRCache = {};
  let page = 1;

  while (true) {
    const res = await githubFetch(
      `${API}/repos/${REPO}/pulls?state=closed&per_page=100&page=${page}`
    );
    const prs = await res.json();
    if (!Array.isArray(prs) || prs.length === 0) break;

    const merged = prs.filter(
      (pr: { merged_at: string | null }) => pr.merged_at
    );

    const fileResults = await Promise.allSettled(
      merged.map(async (pr: GitHubPR) => {
        const filesRes = await githubFetch(
          `${API}/repos/${REPO}/pulls/${pr.number}/files`
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

export async function fetchUserOrgRepos(username: string): Promise<OrgRepo[]> {
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
      `${API}/orgs/${ORG}/repos?per_page=100&page=${page}&sort=updated`
    );
    const data = await safeJson(res);
    if (!Array.isArray(data) || data.length === 0) break;

    for (const repo of data) {
      let contributed = false;
      let prCount = 0;

      // Signal 1: Contributors API
      const contribRes = await githubFetch(
        `${API}/repos/${ORG}/${repo.name}/contributors?per_page=100`
      );
      const contributors = await safeJson(contribRes);
      if (
        Array.isArray(contributors) &&
        contributors.some((c: { login: string }) => c.login?.toLowerCase() === usernameLower)
      ) {
        contributed = true;
      }

      // Signal 2: PRs by this user
      if (!contributed) {
        const prRes = await githubFetch(
          `${API}/search/issues?q=repo:${ORG}/${repo.name}+author:${username}+type:pr&per_page=1`
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
