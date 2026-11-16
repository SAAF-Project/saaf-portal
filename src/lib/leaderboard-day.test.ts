import { describe, expect, it } from "vitest";
import { STANDARDS } from "../components/temple/standards/standards";
import { buildLeaderboard, revealed, type DayInput } from "./leaderboard-day";
import type { Levels } from "./leaderboard";
import { isGrader } from "./grader-auth";
import { stateKey, validateGrades, type BoardState, type Graded } from "./leaderboard-store";
import type { RepoStandards } from "./repo-standards";
import type { History } from "./standards-prizes";

// The public and admin views of the day: freeze, reveal, the grader's to-do list and the guards. Synthetic repos only.

const at = (hm: string) => `2026-11-17T${hm}:00Z`; // UTC: 08:00 is 09:00 in Amsterdam, 14:15 the freeze, 15:15 the close
const tree = (n: number) => n.toString(16).padStart(40, "0");
const checks = (met: number) => Object.fromEntries(STANDARDS.map((s, i) => [s.id, i < met]));
const graded = (levels: Levels, gradedAt = at("13:00")): Graded => ({ levels: { readme: 0, "audit-criteria": 0, "agent-yaml": 0, tests: 0, ci: 0, dependencies: 0, licence: 0, codeowners: 0, ...levels }, gradedAt, feedback: {}, flags: {}, evidence: {}, overridden: [] });
const repo = (name: string, t: number): RepoStandards => ({ name, url: `https://github.com/SAAF-Project/${name}`, private: false, pushed_at: at("10:00"), created_at: "2026-10-01T00:00:00Z", tree_sha: tree(t), checks: checks(3) });
const history = (start: number, steps: [string, string, number][]): History => ({
  start: checks(1),
  startTree: tree(start),
  steps: steps.map(([hm, login, t]) => ({ at: at(hm), login, checks: checks(3), tree: tree(t), opened_at: null, url: null })),
});
const STATE: BoardState = { frozen: false, freezeAt: null, revealStep: 0, disqualified: [] };

/** Five repos, each improved by its own person; a later grade (after the freeze) lifts the fifth to the top. */
function input(over: Partial<DayInput> = {}): DayInput {
  const names = ["example-agent", "sample-service", "fresh-agent", "quiet-agent", "late-agent"];
  const all = new Map<string, Graded>();
  const frozen = new Map<string, Graded>();
  const histories = new Map<string, History | null>();
  names.forEach((n, i) => {
    const start = 100 + i * 10;
    histories.set(n, history(start, [["10:00", `person-${i}`, start + 1]]));
    all.set(stateKey(n, tree(start)), graded({ readme: 1 }));
    all.set(stateKey(n, tree(start + 1)), graded({ readme: 1 + Math.min(i, 2), tests: i }));
  });
  // the last person's work lands at 14:30 and is graded at 15:15: after the freeze
  histories.set("late-agent", history(140, [["10:00", "person-4", 141], ["14:30", "person-4", 142]]));
  all.set(stateKey("late-agent", tree(142)), graded({ readme: 3, "audit-criteria": 3, tests: 3 }, at("15:15")));
  for (const [k, g] of all) if (g.gradedAt <= at("14:15")) frozen.set(k, g);
  return {
    board: { checked_at: at("10:00"), stale: false, ttl_seconds: 60, archived: 0, repos: names.map((n, i) => repo(n, 100 + i * 10 + (n === "late-agent" ? 2 : 1))) },
    histories,
    grades: frozen,
    allGrades: all,
    state: STATE,
    now: at("12:00"),
    view: "public",
    ...over,
  };
}

describe("the public view", () => {
  it("during the day: the standings from the grades so far, with who did it", () => {
    const p = buildLeaderboard(input());
    expect(p.phase).toBe("during");
    expect(p.frozen).toBe(false);
    expect(p.top_contributor.length).toBeGreaterThan(0);
    expect(p.top_contributor.every((r) => !r.masked)).toBe(true);
    expect(p.admin).toBeUndefined();
  });

  it("from 15:15 frozen: grades given after the freeze stay out, and the top three places are hidden", () => {
    const p = buildLeaderboard(input({ now: at("14:50") }));
    expect(p.frozen).toBe(true);
    expect(p.top_contributor.slice(0, 3).every((r) => r.masked && r.login === "?")).toBe(true);
    expect(p.top_contributor.slice(3).every((r) => !r.masked)).toBe(true);
    expect(JSON.stringify(p.top_contributor)).not.toContain("person-4\""); // its late work is not visible, nor its name on top
  });

  it("the reveal shows places from the bottom up, top contributor first and best agent last", () => {
    expect(revealed(0, [5, 4, 3])).toEqual([0, 0, 0]);
    expect(revealed(6, [5, 4, 3])).toEqual([5, 1, 0]);
    expect(revealed(99, [5, 4, 3])).toEqual([5, 4, 3]);
    const one = buildLeaderboard(input({ now: at("15:40"), state: { ...STATE, revealStep: 1 } }));
    expect(one.reveal).toEqual({ step: 1, total: one.reveal!.total });
    const shown = one.top_contributor.filter((r) => !r.masked);
    expect(shown).toHaveLength(1);
    expect(one.top_contributor[one.top_contributor.length - 1].masked).toBeFalsy(); // the lowest place comes first
    const all = buildLeaderboard(input({ now: at("15:40"), state: { ...STATE, revealStep: 99 } }));
    expect(all.top_contributor[0].login).toBe("person-4"); // the final result counts the late work
    expect([...all.best_agent, ...all.most_improved, ...all.top_contributor].some((r) => r.masked)).toBe(false);
  });

  it("disqualified people are left out of the people list", () => {
    const p = buildLeaderboard(input({ state: { ...STATE, disqualified: ["person-2"] }, view: "admin" }));
    expect(p.top_contributor.map((r) => r.login)).not.toContain("person-2");
  });
});

describe("the admin view", () => {
  it("is never frozen and counts every grade, with the grader's to-do list", () => {
    const p = buildLeaderboard(input({ now: at("14:50"), view: "admin" }));
    expect(p.frozen).toBe(false);
    expect(p.top_contributor[0].login).toBe("person-4");
    expect(p.admin?.pending).toEqual([]);
  });

  it("lists states the grader has not seen yet", () => {
    const i = input({ view: "admin" });
    i.histories.set("example-agent", history(100, [["10:00", "person-0", 101], ["11:00", "person-0", 199]]));
    const p = buildLeaderboard(i);
    expect(p.admin?.pending).toEqual([{ repo: "example-agent", tree: tree(199), at: at("11:00") }]);
  });
});

describe("guards", () => {
  it("lets the grader in only with the exact, long token", () => {
    const secret = "x".repeat(40);
    expect(isGrader(`Bearer ${secret}`, secret)).toBe(true);
    expect(isGrader(`Bearer ${secret}y`, secret)).toBe(false);
    expect(isGrader(null, secret)).toBe(false);
    expect(isGrader("Bearer short", "short")).toBe(false); // a short token is never accepted
    expect(isGrader(`Bearer ${secret}`, undefined)).toBe(false);
  });

  it("refuses grades with unknown standards, levels out of range or odd names", () => {
    const { ok, errors } = validateGrades([
      { repo: "example-agent", tree: tree(1), standard: "readme", level: 3 },
      { repo: "example-agent", tree: tree(1), standard: "readme", level: 4 },
      { repo: "example-agent", tree: tree(1), standard: "made-up", level: 1 },
      { repo: "../etc", tree: tree(1), standard: "tests", level: 1 },
      { repo: "example-agent", tree: "HEAD", standard: "tests", level: 1 },
    ]);
    expect(ok).toHaveLength(1);
    expect(errors).toHaveLength(4);
  });
});
