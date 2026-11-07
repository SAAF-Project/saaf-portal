import { describe, expect, it } from "vitest";
import { beforeEach } from "vitest";
import { inspectTree, loadRepoSignals, resetRepoSignalsMemo } from "./repo-signals";

beforeEach(resetRepoSignalsMemo);

const plan = (name: string, stage: number) => ({ repo: { name, url: "", source: "" }, kind: "agent" as const, stage });

describe("inspectTree", () => {
  it("finds AUDIT-CRITERIA.md only in the repo root", () => {
    expect(inspectTree(["README.md", "AUDIT-CRITERIA.md"], false).hasAuditCriteria).toBe(true);
    expect(inspectTree(["docs/AUDIT-CRITERIA.md"], false).hasAuditCriteria).toBe(false);
  });

  it("recognises tests in common layouts, and ignores vendored ones", () => {
    for (const path of ["tests/run.py", "src/__tests__/a.ts", "test_agent.py", "pkg/x_test.go", "src/a.test.tsx", "spec/a.rb"]) {
      expect(inspectTree([path], false).hasTests, path).toBe(true);
    }
    expect(inspectTree(["agent.py", "README.md"], false).hasTests).toBe(false);
    expect(inspectTree(["node_modules/x/tests/a.js", ".venv/lib/site-packages/t/test_a.py"], false).hasTests).toBe(false);
  });

  it("does not claim something is missing from a cut-off list", () => {
    expect(inspectTree(["a.py"], true)).toEqual({ hasAuditCriteria: null, hasTests: null });
    expect(inspectTree(["AUDIT-CRITERIA.md", "tests/a.py"], true)).toEqual({ hasAuditCriteria: true, hasTests: true });
  });
});

function fakeGitHub(opts: { failList?: boolean } = {}) {
  const calls: string[] = [];
  const fetchImpl = (async (url: string) => {
    calls.push(url);
    const ok = (body: unknown) => ({ ok: true, json: async () => body }) as Response;
    if (url.includes("/orgs/SAAF-Project/repos")) {
      if (opts.failList) return { ok: false } as Response;
      return ok([
        { name: "good", archived: false, pushed_at: "2026-10-01T00:00:00Z" },
        { name: "bare", archived: false, pushed_at: "2026-10-01T00:00:00Z" },
        { name: "old", archived: true, pushed_at: "2025-01-01T00:00:00Z" },
        { name: "early", archived: false, pushed_at: "2026-10-01T00:00:00Z" },
      ]);
    }
    if (url.includes("/repos/SAAF-Project/good/git/trees")) return ok({ tree: [{ path: "AUDIT-CRITERIA.md", type: "blob" }, { path: "tests", type: "tree" }, { path: "tests/a.py", type: "blob" }] });
    if (url.includes("/repos/SAAF-Project/bare/git/trees")) return ok({ tree: [{ path: "agent.py", type: "blob" }] });
    return { ok: false } as Response;
  }) as unknown as typeof fetch;
  return { fetchImpl, calls };
}

describe("loadRepoSignals", () => {
  it("returns nothing without a token or when the repo list cannot be read", async () => {
    expect(await loadRepoSignals([plan("good", 3)], fakeGitHub().fetchImpl, undefined)).toBeNull();
    expect(await loadRepoSignals([plan("good", 3)], fakeGitHub({ failList: true }).fetchImpl, "t")).toBeNull();
  });

  it("lists every repo, and inspects only agent repos that are Ready or further and not archived", async () => {
    const { fetchImpl, calls } = fakeGitHub();
    const s = await loadRepoSignals([plan("good", 3), plan("Bare", 5), plan("old", 5), plan("early", 2), plan("gone", 5)], fetchImpl, "t");
    expect(s?.listed).toBe(true);
    expect(s?.repos.good).toMatchObject({ hasAuditCriteria: true, hasTests: true });
    expect(s?.repos.bare).toMatchObject({ hasAuditCriteria: false, hasTests: false });
    expect(s?.repos.old).toMatchObject({ archived: true, hasAuditCriteria: null });
    expect(s?.repos.early).toMatchObject({ hasAuditCriteria: null, hasTests: null });
    expect(s?.repos.gone).toBeUndefined();
    expect(calls.filter((c) => c.includes("/git/trees"))).toHaveLength(2);
  });

  it("asks GitHub once per ten minutes, however many people open the page", async () => {
    const { fetchImpl, calls } = fakeGitHub();
    let t = 0;
    const plans = [plan("good", 3)];
    const [a, b] = await Promise.all([loadRepoSignals(plans, fetchImpl, "t", () => t), loadRepoSignals(plans, fetchImpl, "t", () => t)]);
    expect(b).toBe(a);
    const first = calls.length;
    t = 9 * 60_000;
    await loadRepoSignals(plans, fetchImpl, "t", () => t);
    expect(calls.length).toBe(first);
    t = 11 * 60_000;
    await loadRepoSignals(plans, fetchImpl, "t", () => t);
    expect(calls.length).toBe(first * 2);
  });

  it("retries a failed check after a minute, not after ten", async () => {
    const down = fakeGitHub({ failList: true });
    let t = 0;
    expect(await loadRepoSignals([plan("good", 3)], down.fetchImpl, "t", () => t)).toBeNull();
    const failedCalls = down.calls.length;
    t = 30_000;
    await loadRepoSignals([plan("good", 3)], down.fetchImpl, "t", () => t);
    expect(down.calls.length).toBe(failedCalls);
    t = 61_000;
    await loadRepoSignals([plan("good", 3)], down.fetchImpl, "t", () => t);
    expect(down.calls.length).toBe(failedCalls * 2);
  });

  it("leaves a repo unchecked when its file list cannot be read", async () => {
    const { fetchImpl } = fakeGitHub();
    const s = await loadRepoSignals([plan("early", 5)], fetchImpl, "t"); // 'early' has no tree in the fake: 404
    expect(s?.repos.early).toMatchObject({ hasAuditCriteria: null, hasTests: null });
  });
});
