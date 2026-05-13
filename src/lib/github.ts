const GITHUB_PAT = process.env.GITHUB_PAT!;
const API = "https://api.github.com";
const ORG = "SAAF-Project";
const REPO = "SAAF-Project/SAAF-Project";

async function githubFetch(url: string): Promise<Response> {
  return fetch(url, {
    headers: {
      Authorization: `Bearer ${GITHUB_PAT}`,
      Accept: "application/vnd.github+json",
    },
  });
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
  const res = await githubFetch(
    `${API}/search/repositories?q=org:${ORG}+involves:${username}&per_page=30&sort=updated`
  );
  const data = await res.json();

  if (!Array.isArray(data?.items)) return [];

  return data.items.map((repo: {
    name: string;
    description: string | null;
    language: string | null;
    updated_at: string;
    html_url: string;
    stargazers_count: number;
    fork: boolean;
  }) => ({
    name: repo.name,
    description: repo.description,
    language: repo.language,
    updated_at: repo.updated_at,
    html_url: repo.html_url,
    stargazers_count: repo.stargazers_count,
    fork: repo.fork,
  }));
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
}
