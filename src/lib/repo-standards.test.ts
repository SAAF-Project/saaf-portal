import { beforeEach, describe, expect, it } from "vitest";
import { STANDARDS } from "../components/temple/standards/standards";
import { loadRepoStandards, resetRepoStandardsMemo } from "./repo-standards";

beforeEach(resetRepoStandardsMemo);

const MINUTE = 60_000;
const blob = (path: string, size = 100) => ({ path, type: "blob", size });
const all = (value: boolean | null) => Object.fromEntries(STANDARDS.map((s) => [s.id, value]));

const COMPLETE_TREE = {
  tree: [
    blob("README.md", 2000),
    { path: "tests", type: "tree" },
    ...["agent.yaml", "AUDIT-CRITERIA.md", "SECURITY.md", "LICENSE", "tests/test_agent.py", "requirements.txt", ".github/workflows/ci.yml", ".github/CODEOWNERS"].map((p) => blob(p)),
  ],
};

/** A stand-in for GitHub with synthetic repos. `trees` holds a tree answer per repo, or a status code for a failure. */
function fakeGitHub() {
  const repo = (name: string, extra: Record<string, unknown> = {}) => ({
    name,
    html_url: `https://github.com/SAAF-Project/${name}`,
    private: false,
    archived: false,
    size: 10,
    pushed_at: "2026-11-01T00:00:00Z",
    created_at: "2026-10-01T00:00:00Z",
    ...extra,
  });
  const state = {
    failList: false,
    throwAll: false,
    repos: [
      repo("sample-service", { private: true }),
      repo("example-agent"),
      repo("Bare-agent"),
      repo("old-agent", { archived: true }),
      repo("saaf-portal"),
      repo("SAAF-Project"),
      repo("website"),
      repo(".github"),
    ],
    trees: {
      "example-agent": COMPLETE_TREE,
      "sample-service": { tree: [blob("README.md", 2000), blob("LICENSE")] },
      "Bare-agent": { tree: [blob("README.md", 20)] },
    } as Record<string, unknown>,
  };
  const calls: string[] = [];
  const inits: (RequestInit | undefined)[] = [];
  const fetchImpl = (async (url: string, init?: RequestInit) => {
    calls.push(url);
    inits.push(init);
    if (state.throwAll) throw new Error("network down");
    const answer = (status: number, body: unknown = null) => ({ ok: status === 200, status, json: async () => body }) as Response;
    if (url.includes("/orgs/SAAF-Project/repos")) return state.failList ? answer(500) : answer(200, state.repos);
    const name = /\/repos\/SAAF-Project\/([^/]+)\/git\/trees\/HEAD\?recursive=1$/.exec(url)?.[1];
    const tree = name ? state.trees[decodeURIComponent(name)] : undefined;
    if (tree === undefined) return answer(404);
    return typeof tree === "number" ? answer(tree) : answer(200, tree);
  }) as unknown as typeof fetch;
  const treeCalls = () => calls.filter((c) => c.includes("/git/trees/"));
  const listCalls = () => calls.filter((c) => c.includes("/orgs/SAAF-Project/repos"));
  const push = (name: string, pushed_at: string) => {
    state.repos = state.repos.map((r) => (r.name === name ? { ...r, pushed_at } : r));
  };
  return { fetchImpl, calls, inits, state, treeCalls, listCalls, push };
}

describe("loadRepoStandards", () => {
  it("puts every live repo on the board, in alphabetical order, and leaves out archived, meta and dot repos", async () => {
    const gh = fakeGitHub();
    const p = await loadRepoStandards(gh.fetchImpl, "t", () => Date.UTC(2026, 10, 17, 9, 0));
    expect(p.repos?.map((r) => r.name)).toEqual(["Bare-agent", "example-agent", "sample-service"]);
    expect(p.archived).toBe(1);
    expect(p.stale).toBe(false);
    expect(p.ttl_seconds).toBe(60);
    expect(p.checked_at).toBe("2026-11-17T09:00:00.000Z");
    expect(p.repos?.[1]).toEqual({
      name: "example-agent",
      url: "https://github.com/SAAF-Project/example-agent",
      private: false,
      pushed_at: "2026-11-01T00:00:00Z",
      created_at: "2026-10-01T00:00:00Z",
      checks: all(true),
    });
    expect(p.repos?.[2]).toMatchObject({ private: true, checks: { ...all(false), readme: true, licence: true } });
    expect(p.repos?.[0].checks).toEqual(all(false)); // a README of 20 bytes is a placeholder
    expect(gh.listCalls()).toHaveLength(1);
    expect(gh.treeCalls()).toHaveLength(3);
  });

  it("sends the server token, and skips the fetch cache so a merge shows within the minute", async () => {
    const gh = fakeGitHub();
    await loadRepoStandards(gh.fetchImpl, "secret-token", () => 0);
    for (const init of gh.inits) {
      expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer secret-token");
      expect(init?.cache).toBe("no-store");
    }
  });

  it("asks GitHub nothing within the minute, however many people have the board open", async () => {
    const gh = fakeGitHub();
    let t = 0;
    const [a, b] = await Promise.all([loadRepoStandards(gh.fetchImpl, "t", () => t), loadRepoStandards(gh.fetchImpl, "t", () => t)]);
    expect(b).toBe(a);
    const first = gh.calls.length;
    expect(first).toBe(4);
    t = MINUTE - 1;
    expect(await loadRepoStandards(gh.fetchImpl, "t", () => t)).toBe(a);
    expect(gh.calls.length).toBe(first);
  });

  it("after the minute asks only for the repo list when nothing was pushed", async () => {
    const gh = fakeGitHub();
    let t = 0;
    const a = await loadRepoStandards(gh.fetchImpl, "t", () => t);
    t = MINUTE + 1;
    const b = await loadRepoStandards(gh.fetchImpl, "t", () => t);
    expect(gh.listCalls()).toHaveLength(2);
    expect(gh.treeCalls()).toHaveLength(3);
    expect(b.repos).toEqual(a.repos);
    expect(b.checked_at).not.toBe(a.checked_at);
  });

  it("reads one file list again when that repo was pushed, and turns the tile on", async () => {
    const gh = fakeGitHub();
    let t = 0;
    const before = await loadRepoStandards(gh.fetchImpl, "t", () => t);
    expect(before.repos?.[2].checks.security).toBe(false);

    gh.state.trees["sample-service"] = { tree: [blob("README.md", 2000), blob("LICENSE"), blob("SECURITY.md")] };
    gh.push("sample-service", "2026-11-17T10:00:00Z");
    t = MINUTE + 1;
    const after = await loadRepoStandards(gh.fetchImpl, "t", () => t);
    expect(gh.treeCalls()).toHaveLength(4);
    expect(gh.treeCalls()[3]).toContain("/repos/SAAF-Project/sample-service/");
    expect(after.repos?.[2]).toMatchObject({ pushed_at: "2026-11-17T10:00:00Z", checks: { security: true, tests: false } });
  });

  it("shows a repo as not checked when its file list cannot be read, and asks again at the next refresh", async () => {
    const gh = fakeGitHub();
    gh.state.trees["example-agent"] = 502;
    let t = 0;
    const down = await loadRepoStandards(gh.fetchImpl, "t", () => t);
    expect(down.repos?.[1].checks).toEqual(all(null));
    expect(down.repos?.[2].checks.readme).toBe(true); // the other repos are not affected

    gh.state.trees["example-agent"] = COMPLETE_TREE;
    t = MINUTE + 1;
    const up = await loadRepoStandards(gh.fetchImpl, "t", () => t);
    expect(up.repos?.[1].checks).toEqual(all(true));
    expect(gh.treeCalls()).toHaveLength(4); // only the failed one was asked again

    t = 2 * MINUTE + 2;
    await loadRepoStandards(gh.fetchImpl, "t", () => t);
    expect(gh.treeCalls()).toHaveLength(4); // and now it is kept
  });

  it("never says missing from a cut-off file list", async () => {
    const gh = fakeGitHub();
    gh.state.trees["example-agent"] = { tree: [blob("README.md", 2000)], truncated: true };
    let t = 0;
    const p = await loadRepoStandards(gh.fetchImpl, "t", () => t);
    expect(p.repos?.[1].checks).toEqual({ ...all(null), readme: true });
    t = MINUTE + 1;
    await loadRepoStandards(gh.fetchImpl, "t", () => t);
    expect(gh.treeCalls()).toHaveLength(4); // asked again
  });

  it("knows an empty repo by GitHub's answer, not by the size in the list", async () => {
    const gh = fakeGitHub();
    gh.state.repos.push({ ...gh.state.repos[1], name: "empty-repo", size: 0 }, { ...gh.state.repos[1], name: "new-agent", size: 0 });
    gh.state.trees["empty-repo"] = 409; // "Git Repository is empty."
    gh.state.trees["new-agent"] = COMPLETE_TREE; // has files, though the list still says size 0
    let t = 0;
    const p = await loadRepoStandards(gh.fetchImpl, "t", () => t);
    expect(p.repos?.find((r) => r.name === "empty-repo")?.checks).toEqual(all(false));
    expect(p.repos?.find((r) => r.name === "new-agent")?.checks).toEqual(all(true));
    const calls = gh.treeCalls().length;
    t = MINUTE + 1;
    await loadRepoStandards(gh.fetchImpl, "t", () => t);
    expect(gh.treeCalls()).toHaveLength(calls); // the empty repo is not asked again until it is pushed
  });

  it("keeps the last good board, marked stale, when the repo list cannot be read", async () => {
    const gh = fakeGitHub();
    let t = 0;
    const good = await loadRepoStandards(gh.fetchImpl, "t", () => t);

    gh.state.failList = true;
    t = MINUTE + 1;
    const stale = await loadRepoStandards(gh.fetchImpl, "t", () => t);
    expect(stale.stale).toBe(true);
    expect(stale.repos).toEqual(good.repos);
    expect(stale.checked_at).toBe(good.checked_at);
    expect(gh.treeCalls()).toHaveLength(3);

    gh.state.failList = false;
    t = 2 * MINUTE + 2;
    const back = await loadRepoStandards(gh.fetchImpl, "t", () => t);
    expect(back.stale).toBe(false);
    expect(gh.treeCalls()).toHaveLength(3); // the kept answers are still good
  });

  it("has no board when the repo list has never been read, and tries again after a minute", async () => {
    const gh = fakeGitHub();
    gh.state.failList = true;
    let t = 0;
    const p = await loadRepoStandards(gh.fetchImpl, "t", () => t);
    expect(p).toEqual({ checked_at: null, stale: false, ttl_seconds: 60, repos: null, archived: null });
    t = 30_000;
    await loadRepoStandards(gh.fetchImpl, "t", () => t);
    expect(gh.calls).toHaveLength(1);

    gh.state.failList = false;
    t = MINUTE + 1;
    expect((await loadRepoStandards(gh.fetchImpl, "t", () => t)).repos).toHaveLength(3);
  });

  it("has no board, and does not throw, when GitHub cannot be reached at all", async () => {
    const gh = fakeGitHub();
    gh.state.throwAll = true;
    expect((await loadRepoStandards(gh.fetchImpl, "t", () => 0)).repos).toBeNull();
  });

  it("has no board and calls nothing without a token", async () => {
    const gh = fakeGitHub();
    expect(await loadRepoStandards(gh.fetchImpl, undefined)).toEqual({ checked_at: null, stale: false, ttl_seconds: 60, repos: null, archived: null });
    expect(await loadRepoStandards(gh.fetchImpl, "")).toMatchObject({ repos: null });
    expect(gh.calls).toHaveLength(0);
  });
});
