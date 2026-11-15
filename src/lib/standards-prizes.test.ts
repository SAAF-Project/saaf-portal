import { beforeEach, describe, expect, it } from "vitest";
import { STANDARDS } from "../components/temple/standards/standards";
import type { RepoStandards, StandardsPayload } from "./repo-standards";
import { HARDENING_DAY, loadPrizes, resetPrizesMemo } from "./standards-prizes";

beforeEach(resetPrizesMemo);

const at = (hhmm: string) => `2026-11-17T${hhmm}:00Z`; // UTC; the day runs 08:00-15:15 UTC
const now = (hhmm: string) => () => Date.parse(at(hhmm));
const ids = STANDARDS.map((s) => s.id);
/** Checks with the first `met` standards in place. */
const checks = (met: number) => Object.fromEntries(ids.map((id, i) => [id, i < met]));

const repo = (name: string, met: number, pushed: string, created = "2026-10-01T00:00:00Z"): RepoStandards => ({
  name,
  url: `https://github.com/SAAF-Project/${name}`,
  private: false,
  pushed_at: pushed,
  created_at: created,
  checks: checks(met),
});
const board = (repos: RepoStandards[]): StandardsPayload => ({ checked_at: at("10:00"), stale: false, ttl_seconds: 60, repos, archived: 0 });

// File lists with a given number of standards in place, in the order of STANDARDS.
const FILES = [
  { path: "README.md", type: "blob", size: 2000 },
  { path: "agent.yaml", type: "blob", size: 10 },
  { path: "AUDIT-CRITERIA.md", type: "blob", size: 10 },
  { path: "SECURITY.md", type: "blob", size: 10 },
  { path: "LICENSE", type: "blob", size: 10 },
  { path: "tests/test_agent.py", type: "blob", size: 10 },
  { path: "requirements.txt", type: "blob", size: 10 },
  { path: ".github/workflows/ci.yml", type: "blob", size: 10 },
  { path: ".github/CODEOWNERS", type: "blob", size: 10 },
];
const treeWith = (met: number) => ({ tree: FILES.slice(0, met), truncated: false });

const commit = (sha: string, date: string, tree: string, parents: string[]) => ({
  sha,
  parents: parents.map((p) => ({ sha: p })),
  commit: { tree: { sha: tree }, committer: { date } },
});

/** A stand-in for GitHub: commit lists, trees and pull requests per synthetic repo. */
function fakeGitHub(state: {
  commits: Record<string, unknown[] | number>;
  trees: Record<string, unknown>;
  pulls?: Record<string, unknown[]>;
}) {
  const calls: string[] = [];
  const fetchImpl = (async (url: string) => {
    calls.push(url);
    const answer = (status: number, body: unknown = null) => ({ ok: status === 200, status, json: async () => body }) as Response;
    const m = /\/repos\/SAAF-Project\/([^/]+)\/(.*)$/.exec(url);
    if (!m) return answer(404);
    const [, name, rest] = m;
    if (rest.startsWith("commits?")) {
      const list = state.commits[name];
      return list === undefined ? answer(404) : typeof list === "number" ? answer(list) : answer(200, list);
    }
    if (rest.startsWith("git/trees/")) {
      const sha = rest.slice("git/trees/".length).split("?")[0];
      return sha in state.trees ? answer(200, state.trees[sha]) : answer(404);
    }
    if (rest.startsWith("pulls?")) return answer(200, state.pulls?.[name] ?? []);
    return answer(404);
  }) as unknown as typeof fetch;
  return { fetchImpl, calls };
}

describe("loadPrizes", () => {
  it("before the day: says when counting starts and reads nothing from GitHub", async () => {
    const gh = fakeGitHub({ commits: {}, trees: {} });
    const p = await loadPrizes(board([repo("example-agent", 5, at("07:00"))]), gh.fetchImpl, "t", now("07:30"));
    expect(p.phase).toBe("before");
    expect(p.first_nine).toEqual([]);
    expect(p.tiles).toBeNull();
    expect(gh.calls).toEqual([]);
  });

  it("during the day: reads the start from history along the default branch, and finds when a repo reached nine", async () => {
    const gh = fakeGitHub({
      commits: {
        // newest first, as GitHub lists them. f1 is a commit of a merged branch: complete, but never on main on its own.
        "sample-service": [
          commit("m2", at("11:00"), "t-m2", ["m1", "f1"]),
          commit("f1", at("10:30"), "t-f1", ["m1"]),
          commit("m1", at("10:00"), "t-m1", ["c0"]),
          commit("c0", at("07:00"), "t-c0", []),
        ],
      },
      trees: { "t-c0": treeWith(3), "t-m1": treeWith(7), "t-f1": treeWith(9), "t-m2": treeWith(9) },
      pulls: {
        "sample-service": [
          { merged_at: at("11:00"), user: { login: "alice" } },
          { merged_at: at("10:00"), user: { login: "bob" } },
          { merged_at: at("10:15"), user: { login: "dependabot[bot]" } },
          { merged_at: "2026-11-10T12:00:00Z", user: { login: "carol" } },
          { merged_at: null, user: { login: "dave" } },
        ],
      },
    });
    const p = await loadPrizes(
      board([
        repo("example-agent", 5, at("07:00")), // untouched since before the start
        repo("sample-service", 9, at("11:00")),
        repo("fresh-agent", 9, at("09:30"), at("09:00")), // made during the day
      ]),
      gh.fetchImpl,
      "t",
      now("12:00"),
    );
    expect(p.phase).toBe("during");
    expect(p.first_nine).toEqual([
      { name: "sample-service", url: "https://github.com/SAAF-Project/sample-service", before: 3, after: 9, jump: 6, reached_at: at("11:00"), by: ["alice", "bob"] },
    ]);
    expect(p.biggest_jump.map((r) => [r.name, r.jump])).toEqual([["sample-service", 6]]);
    expect(p.new_repos).toEqual([{ name: "fresh-agent", url: "https://github.com/SAAF-Project/fresh-agent", met: 9 }]);
    expect(p.tiles).toEqual({ start: 8, now: 14 });
    expect(p.unread).toBe(0);
    // a repo nobody pushed to since the start costs no call at all
    expect(gh.calls.some((c) => c.includes("/example-agent/"))).toBe(false);
  });

  it("after the day: counts the default branch as it was at the end, not later pushes", async () => {
    const gh = fakeGitHub({
      commits: {
        "example-agent": [
          commit("late", at("16:00"), "t-late", ["m1"]), // after 15:15 UTC: too late
          commit("m1", at("12:00"), "t-m1", ["c0"]),
          commit("c0", "2026-11-01T00:00:00Z", "t-c0", []),
        ],
      },
      trees: { "t-c0": treeWith(2), "t-m1": treeWith(6), "t-late": treeWith(9) },
    });
    const p = await loadPrizes(board([repo("example-agent", 9, at("16:00"))]), gh.fetchImpl, "t", now("17:00"));
    expect(p.phase).toBe("after");
    expect(p.biggest_jump.map((r) => [r.name, r.before, r.after])).toEqual([["example-agent", 2, 6]]);
    expect(p.first_nine).toEqual([]);
  });

  it("an existing repo without a commit at the start begins at zero; a repo whose history cannot be read is left out, not zeroed", async () => {
    const gh = fakeGitHub({
      commits: {
        "Bare-agent": [commit("m1", at("10:00"), "t-m1", [])],
        "broken-agent": 500,
      },
      trees: { "t-m1": treeWith(4) },
    });
    const p = await loadPrizes(
      board([repo("Bare-agent", 4, at("10:00")), repo("broken-agent", 6, at("10:00"))]),
      gh.fetchImpl,
      "t",
      now("12:00"),
    );
    expect(p.biggest_jump.map((r) => [r.name, r.before, r.after])).toEqual([["Bare-agent", 0, 4]]);
    expect(p.unread).toBe(1);
  });

  it("keeps the start once read and works out the answer at most once a minute", async () => {
    const gh = fakeGitHub({
      commits: { "sample-service": [commit("m1", at("10:00"), "t-m1", ["c0"]), commit("c0", at("07:00"), "t-c0", [])] },
      trees: { "t-c0": treeWith(1), "t-m1": treeWith(3) },
    });
    const b = board([repo("sample-service", 3, at("10:00"))]);
    await loadPrizes(b, gh.fetchImpl, "t", now("12:00"));
    const first = gh.calls.length;
    await loadPrizes(b, gh.fetchImpl, "t", () => Date.parse(at("12:00")) + 30_000);
    expect(gh.calls.length).toBe(first);
    await loadPrizes(b, gh.fetchImpl, "t", now("12:05"));
    expect(gh.calls.filter((c) => c.includes("commits?")).length).toBe(1);
  });

  it("without a token: no answer, and no call", async () => {
    const gh = fakeGitHub({ commits: {}, trees: {} });
    const p = await loadPrizes(board([]), gh.fetchImpl, undefined, now("12:00"));
    expect(p.computed_at).toBeNull();
    expect(gh.calls).toEqual([]);
  });

  it("covers 09:00 to 16:15 in Amsterdam", () => {
    const local = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { timeZone: "Europe/Amsterdam", hour: "2-digit", minute: "2-digit" });
    expect([local(HARDENING_DAY.start), local(HARDENING_DAY.end)]).toEqual(["09:00", "16:15"]);
  });
});
