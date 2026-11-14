import { tally } from "../components/temple/standards/standards";
import { mapLimited } from "./repo-signals";
import { loadRepoStandards, type RepoStandards } from "./repo-standards";
import { isRevivable } from "./revivable";

// The "Reviver" achievement: the agents a member has revived. A member has revived an agent when all three hold:
//   1. the repo is on the list of repos that were quiet before the hardening day (revivable.ts);
//   2. the repo has all nine standards in place on its default branch (the standards board);
//   3. the CODEOWNERS file on the default branch names the member.
// Becoming owner alone earns nothing, and neither does hardening a repo that was never quiet.
//
// The repos and their checks come from the board loader (repo-standards.ts), so there is no second scan of the
// organisation. Only for a repo that passes 1 and 2 is one file read: its CODEOWNERS. That text is kept per repo until
// the repo's `pushed_at` changes, so a dashboard load normally costs no GitHub call. A read that fails is not kept:
// the repo counts as "not revived" for now and is asked again at the next load. Never an error for the member.

const ORG = "SAAF-Project";
const API = "https://api.github.com";
const CONCURRENCY = 6;
/** The places GitHub reads CODEOWNERS from, in the order they are tried here. The first one that exists is used. */
const CODEOWNERS_PATHS = ["CODEOWNERS", ".github/CODEOWNERS", "docs/CODEOWNERS"];

type Fetch = typeof fetch;
type Repo = Pick<RepoStandards, "name" | "pushed_at" | "checks">;
/** The CODEOWNERS text of a repo's default branch. `null` = could not be read (now). May throw: that counts as null. */
export type ReadCodeowners = (repo: Pick<RepoStandards, "name" | "pushed_at">) => Promise<string | null>;

/** A GitHub login on its own: letters, digits and single hyphens, at most 39 characters. `@org/team` does not match. */
const HANDLE = /^@([a-z\d](?:[a-z\d-]{0,37}[a-z\d])?)$/i;

/**
 * The people a CODEOWNERS file names, as lower-case logins without the `@`, each once.
 * Comments do not count (a line that starts with `#`, and the rest of a line after ` #`), and neither do team handles
 * (`@org/team`) or e-mail addresses. A handle counts only as a whole word, so `@anna` does not name `ann`.
 */
export function ownersOf(codeownersText: string): string[] {
  const owners = new Set<string>();
  for (const line of codeownersText.split(/\r?\n/)) {
    const code = line.replace(/(^|\s)#.*$/, "");
    for (const word of code.split(/\s+/)) {
      const login = HANDLE.exec(word)?.[1];
      if (login) owners.add(login.toLowerCase());
    }
  }
  return [...owners];
}

/**
 * The names of the repos `login` has revived, in the order of `repos`. CODEOWNERS is read only for a repo that is
 * revivable and complete. A read that fails or throws leaves that repo out; this function does not throw.
 */
export async function revivedBy(
  login: string,
  repos: Repo[],
  readCodeowners: ReadCodeowners,
  revivable: (name: string) => boolean = isRevivable,
): Promise<string[]> {
  const who = login.trim().toLowerCase();
  if (!who) return [];
  const candidates = repos.filter((r) => revivable(r.name) && tally(r.checks).complete);
  const owned = await mapLimited(candidates, CONCURRENCY, async (r) => {
    try {
      const text = await readCodeowners(r);
      return text !== null && ownersOf(text).includes(who);
    } catch {
      return false;
    }
  });
  return candidates.filter((_, i) => owned[i]).map((r) => r.name);
}

/** One file of a repo's default branch as text. `undefined` = it is not there (404); `null` = no answer. */
async function getText(url: string, token: string, fetchImpl: Fetch): Promise<string | null | undefined> {
  try {
    const res = await fetchImpl(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github.raw+json" },
      cache: "no-store",
    });
    if (res.status === 404) return undefined;
    return res.ok ? await res.text() : null;
  } catch {
    return null;
  }
}

async function fetchCodeowners(name: string, token: string, fetchImpl: Fetch): Promise<string | null> {
  for (const path of CODEOWNERS_PATHS) {
    const text = await getText(`${API}/repos/${ORG}/${encodeURIComponent(name)}/contents/${path}`, token, fetchImpl);
    if (text !== undefined) return text; // found, or no answer: either way the next place is not tried
  }
  return null; // in none of the three places, while the board saw one: asked again at the next load
}

// Kept per server instance: the CODEOWNERS text per repo, for as long as its `pushed_at` stays the same. The promise is
// kept, so two members who load their dashboard at the same moment share one read. A failed read is dropped again.
const kept = new Map<string, { pushed_at: string | null; text: Promise<string | null> }>();

/** A reader that asks GitHub once per repo and push. */
export function codeownersReader(fetchImpl: Fetch, token: string): ReadCodeowners {
  return (repo) => {
    const hit = kept.get(repo.name);
    if (hit && hit.pushed_at === repo.pushed_at) return hit.text;
    const entry = { pushed_at: repo.pushed_at, text: fetchCodeowners(repo.name, token, fetchImpl) };
    kept.set(repo.name, entry);
    void entry.text.then((text) => {
      if (text === null && kept.get(repo.name) === entry) kept.delete(repo.name);
    });
    return entry.text;
  };
}

/** The repos the member with this GitHub login has revived. Never throws; no answer from GitHub = none, for now. */
export async function loadRevived(
  login: string,
  fetchImpl: Fetch = fetch,
  token: string | undefined = process.env.GITHUB_PAT,
  now: () => number = Date.now,
  revivable: (name: string) => boolean = isRevivable,
): Promise<string[]> {
  if (!token) return [];
  try {
    const { repos } = await loadRepoStandards(fetchImpl, token, now);
    if (!repos) return [];
    return await revivedBy(login, repos, codeownersReader(fetchImpl, token), revivable);
  } catch {
    return [];
  }
}

/** For tests: forget the CODEOWNERS texts that are kept. */
export function resetRevivedMemo(): void {
  kept.clear();
}
