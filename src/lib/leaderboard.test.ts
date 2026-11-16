import { describe, expect, it } from "vitest";
import { MAX_POINTS, QUICK_CAP, counts, points, pointsAt, scoreDay, type DayStep, type Levels, type RepoDay } from "./leaderboard";

// The scoring rules, each in its smallest case. Synthetic repos and people only. Times in UTC: the day closes at 15:15.

const at = (hm: string) => `2026-11-17T${hm}:00Z`;
const W = { end: at("15:15"), until: at("15:15") };
let n = 0;
const step = (hm: string, login: string | null, levels: Levels | null, extra: Partial<DayStep> = {}): DayStep => ({ sha: `s${n++}`, at: at(hm), login, levels, ...extra });
const repo = (name: string, start: Levels, steps: DayStep[], made_today = false): RepoDay => ({ name, url: `https://github.com/SAAF-Project/${name}`, made_today, start, steps });
const person = (s: ReturnType<typeof scoreDay>, login: string) => s.top_contributor.find((p) => p.login === login)?.points ?? 0;

describe("points", () => {
  it("rise faster than levels: depth beats breadth", () => {
    expect(pointsAt("readme", 3)).toBeGreaterThan(4 * pointsAt("readme", 1));
    expect(points({ readme: 3, "audit-criteria": 3, "agent-yaml": 3, tests: 3, ci: 3, dependencies: 2, licence: 1, codeowners: 1, security: 0 })).toBe(MAX_POINTS);
  });
});

describe("credit", () => {
  it("goes to whoever raised a level, and only by as much as was raised", () => {
    const s = scoreDay([repo("example-agent", { readme: 1 }, [step("10:00", "alice", { readme: 2 }), step("11:00", "bob", { readme: 3 })])], W);
    expect(person(s, "alice")).toBe(pointsAt("readme", 2) - pointsAt("readme", 1));
    expect(person(s, "bob")).toBe(pointsAt("readme", 3) - pointsAt("readme", 2));
  });

  it("nonsense earns nothing; a second fix of the same thing earns nothing", () => {
    const s = scoreDay([repo("example-agent", {}, [step("10:00", "junk", { readme: 0 }), step("10:05", "alice", { "audit-criteria": 2 }), step("10:10", "bob", { "audit-criteria": 2 })])], W);
    expect(person(s, "junk")).toBe(0);
    expect(person(s, "bob")).toBe(0);
    expect(person(s, "alice")).toBe(pointsAt("audit-criteria", 2));
  });

  it("removed and put back: nothing for the one who put it back", () => {
    const s = scoreDay([repo("example-agent", {}, [step("10:00", "alice", { tests: 3 }), step("10:30", "thief", { tests: 0 }), step("10:40", "thief", { tests: 3 })])], W);
    expect(person(s, "thief")).toBe(0);
    expect(person(s, "alice")).toBe(pointsAt("tests", 3));
  });

  it("raised and then lost: only what stands at the end is credited", () => {
    const s = scoreDay([repo("example-agent", {}, [step("10:00", "alice", { readme: 3 }), step("11:00", "bob", { readme: 1 })])], W);
    expect(person(s, "alice")).toBe(pointsAt("readme", 1));
    expect(person(s, "bob")).toBe(0);
  });

  it("quick standards count for at most the cap per person", () => {
    const repos = Array.from({ length: 10 }, (_, i) => repo(`agent-${i}`, {}, [step(`10:${String(i).padStart(2, "0")}`, "speedy", { licence: 1, codeowners: 1 })]));
    const s = scoreDay(repos, W);
    expect(person(s, "speedy")).toBe(QUICK_CAP);
    expect(s.top_contributor[0].capped).toBe(20 - QUICK_CAP);
  });

  it("bots and disqualified people get nothing; their part goes to nobody", () => {
    const s = scoreDay([repo("example-agent", {}, [step("10:00", "dependabot[bot]", { dependencies: 2 }), step("10:10", "injector", { tests: 3 })])], W, 5, new Set(["injector"]));
    expect(s.top_contributor).toEqual([]);
    expect(s.repos[0].uncredited).toBe(s.repos[0].rise);
  });

  it("a repo made today starts at its first state: the template is nobody's work", () => {
    const s = scoreDay([repo("fresh-agent", {}, [step("10:00", "maker", { licence: 1, ci: 3, tests: 2 }), step("11:00", "alice", { licence: 1, ci: 3, tests: 3 })], true)], W);
    expect(person(s, "maker")).toBe(0);
    expect(person(s, "alice")).toBe(pointsAt("tests", 3) - pointsAt("tests", 2));
    expect(s.most_improved).toEqual([]); // new repos are not in "most improved"
  });

  it("the order of merges does not change anyone's score when work does not overlap", () => {
    const a = step("10:00", "alice", { readme: 3 });
    const b = step("10:00", "bob", { readme: 3, tests: 2 });
    const one = scoreDay([repo("x", {}, [{ ...a, at: at("10:00") }, { ...b, at: at("10:05") }])], W);
    const two = scoreDay([repo("x", {}, [{ ...step("10:00", "bob", { tests: 2 }) }, { ...step("10:05", "alice", { readme: 3, tests: 2 }) }])], W);
    expect(person(one, "alice") + person(one, "bob")).toBe(person(two, "alice") + person(two, "bob"));
  });
});

describe("time", () => {
  it("a merge at 15:14:59 counts, one at 15:15:01 does not, unless its pull request was opened in time and merged in the grace period", () => {
    const w = { end: at("15:15"), until: at("16:00") };
    expect(counts({ sha: "a", at: "2026-11-17T15:14:59Z", login: "x", levels: {} }, w)).toBe(true);
    expect(counts({ sha: "b", at: "2026-11-17T15:15:01Z", login: "x", levels: {} }, w)).toBe(false);
    expect(counts({ sha: "c", at: "2026-11-17T15:30:00Z", login: "x", levels: {}, opened_at: at("15:10") }, w)).toBe(true);
    expect(counts({ sha: "d", at: "2026-11-17T15:50:00Z", login: "x", levels: {}, opened_at: at("15:10") }, w)).toBe(false);
  });

  it("a state the grader has not seen yet waits; it counts once graded", () => {
    const s = scoreDay([repo("example-agent", {}, [step("10:00", "alice", null)])], W);
    expect(s.repos[0].pending).toBe(1);
    expect(person(s, "alice")).toBe(0);
  });
});

describe("prizes", () => {
  it("best agent needs a real gain today; most improved is the gain; ties go to whoever got there first", () => {
    const s = scoreDay(
      [
        repo("already-good", { readme: 3, "audit-criteria": 3 }, [step("10:00", "a", { readme: 3, "audit-criteria": 3, licence: 1 })]),
        repo("late-riser", {}, [step("12:00", "b", { readme: 3 })]),
        repo("early-riser", {}, [step("11:00", "c", { readme: 3 })]),
      ],
      W,
    );
    expect(s.best_agent.map((r) => r.name)).toEqual(["early-riser", "late-riser"]); // already-good gained only 1
    expect(s.most_improved.map((r) => r.name)).toEqual(["early-riser", "late-riser", "already-good"]);
  });
});
