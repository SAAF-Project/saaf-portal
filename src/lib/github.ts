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

// Curated agents — manually reviewed for code quality.
export const AGENT_LIBRARY_REVIEWED: Record<string, ReviewedAgent> = {
  "GDPR-AI-Audit-Agent": {
    category: "Compliance",
    tags: ["GDPR", "PII", "DPIA"],
    quality: {
      hasTests: true,
      testCount: 10,
      hasSamples: true,
      notes: "Full Python package + Streamlit UI. Includes official GDPR text as reference data.",
    },
  },
  "Vendor_Guard": {
    category: "Compliance",
    tags: ["Vendor Risk", "DORA", "ISO 27001", "EU AI Act"],
    quality: {
      hasTests: true,
      testCount: 8,
      hasSamples: true,
      notes: "Multi-agent architecture: 6 specialised agents + 4 synthesisers across 8 frameworks.",
    },
  },
  "RCM-Builder": {
    category: "Risk & Controls",
    tags: ["RCM", "GIAS", "UC7"],
    quality: {
      hasTests: true,
      testCount: 2,
      hasSamples: false,
      notes: "Three-stage pipeline (normalise → design → IT validation) with thorough test coverage.",
    },
  },
  "Track-2-Evidence-Collection-Extraction": {
    category: "Evidence",
    tags: ["Compliance", "GIAS", "PDF"],
    quality: {
      hasTests: true,
      testCount: 1,
      hasSamples: false,
      notes: "CLI + Streamlit web UI. GIAS v2024 8-step reasoning trail.",
    },
  },
  "llm_owasp": {
    category: "AI Security",
    tags: ["OWASP", "LLM", "Red-team"],
    quality: {
      hasTests: false,
      hasSamples: true,
      notes: "Audits other AI agents. Includes CLI + Claude Code slash command integration.",
    },
  },
  "CUEC_Crosscheck": {
    category: "Compliance",
    tags: ["CUEC", "ISAE 3402", "SOC 2"],
    quality: {
      hasTests: false,
      hasSamples: true,
      notes: "Single-file MVP — focused use case. Sample inputs included.",
    },
  },
};

async function githubFetch(url: string, acceptOverride?: string): Promise<Response> {
  return fetch(url, {
    headers: {
      Authorization: `Bearer ${GITHUB_PAT}`,
      Accept: acceptOverride || "application/vnd.github+json",
    },
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

export async function fetchAgentLibrary(): Promise<AgentRepo[]> {
  const repos: AgentRepo[] = [];
  let page = 1;

  while (true) {
    const res = await githubFetch(
      `${API}/orgs/${ORG}/repos?per_page=100&page=${page}&sort=pushed`
    );
    if (!res.ok) break;
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) break;

    for (const repo of data) {
      if (META_REPOS.has(repo.name) || repo.archived) continue;

      const reviewed = AGENT_LIBRARY_REVIEWED[repo.name];

      // Fetch README
      let readmeExcerpt: string | null = null;
      let readmeSize = 0;
      try {
        const readmeRes = await githubFetch(
          `${API}/repos/${ORG}/${repo.name}/readme`,
          "application/vnd.github.raw+json"
        );
        if (readmeRes.ok) {
          const text = await readmeRes.text();
          readmeSize = text.length;
          readmeExcerpt = extractExcerpt(text);
        }
      } catch {}

      // Determine status
      let status: AgentStatus;
      if (reviewed) {
        status = "reviewed";
      } else if (readmeSize === 0) {
        status = "needs-readme";
      } else if (readmeSize < 200) {
        status = "work-in-progress";
      } else {
        status = "not-reviewed";
      }

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

export async function isOrgMember(username: string): Promise<boolean> {
  const res = await githubFetch(`${API}/orgs/${ORG}/members/${username}`);
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
