import { describe, expect, it } from "vitest";
import { EMPTY_CHECKS, mergeChecks, setPlace, toChecksDoc, validateChecks } from "./day-checks";
import { DAY_TRACKS, RULES, SHORT_RULES, TRACK1_PRIZE, trackOfKind } from "./day-tracks";
import { DEMO_KINDS, demoSession, isDemoKind, overKind } from "./demo-sessions";

// The three tracks of the hardening day and what hangs on them: the demo kinds and the store of track 3.

describe("the three tracks", () => {
  it("are three, each with its own demo kind, a way to win and a start prompt", () => {
    expect(DAY_TRACKS.map((t) => t.number)).toEqual([1, 2, 3]);
    expect(DAY_TRACKS.map((t) => t.demo.kind).sort()).toEqual([...DEMO_KINDS].sort());
    for (const t of DAY_TRACKS) {
      expect(t.name.endsWith(".")).toBe(true);
      expect(t.win.length).toBeGreaterThan(20);
      expect(t.prompt).toMatch(/pull request/);
      expect(t.prompt).toMatch(/[Dd]o not merge/);
      expect(trackOfKind(t.demo.kind)).toBe(t);
    }
    expect(trackOfKind("")).toBeNull();
    expect(["most_improved", "best_agent"]).toContain(TRACK1_PRIZE);
  });

  it("the copy keeps to what was agreed: no red teaming, no clock time for the afternoon guest, a teammate merges", () => {
    const all = [...RULES, ...SHORT_RULES, ...DAY_TRACKS.flatMap((t) => [t.name, t.what, t.win, t.prompt, t.demo.label, t.demo.hint])].join(" ");
    expect(all.toLowerCase()).not.toContain("red team");
    expect(all).not.toContain("14:00");
    expect(all).not.toContain("a maintainer merges");
    expect(SHORT_RULES.join(" ").toLowerCase()).toContain("a teammate with write access reviews and merges");
  });
});

describe("demo kinds", () => {
  it("knows the three kinds", () => {
    expect(isDemoKind("checks")).toBe(true);
    expect(isDemoKind("journey")).toBe(true);
    expect(isDemoKind("quiz")).toBe(false);
    expect(isDemoKind(undefined)).toBe(false);
  });

  it("allows two per track on the hardening day, and says which track has too many", () => {
    const s = demoSession("2026-11-17")!;
    expect(s.maxPerKind).toBe(2);
    expect(overKind(["journey", "journey", "standard", "standard", "checks", "checks"], s.maxPerKind)).toEqual([]);
    expect(overKind(["journey", "journey", "journey", "checks"], s.maxPerKind)).toEqual(["journey"]);
    expect(overKind(["journey", "journey", "journey"], undefined)).toEqual([]); // a session without a limit per kind
    expect(overKind(["", "", ""], 2)).toEqual([]); // entries without a kind never block
  });
});

describe("track 3: the repos with LLM checks and the jury's places", () => {
  const row = (repo: string, extra: Record<string, unknown> = {}) => ({ repo, authors: ["alice"], title: repo, llm: 4, code: 2, score: 0, place: null, feedback: null, flags: [], ...extra });

  it("takes good rows and refuses bad ones with the reason", () => {
    const { ok, errors } = validateChecks([row("sample-service"), row("bad repo name"), row("example-agent", { llm: -1 }), row("other-agent", { place: 4 }), { repo: "third-agent", llm: 1, code: 0 }]);
    expect(ok.map((r) => r.repo)).toEqual(["sample-service", "third-agent"]);
    expect(ok[1]).toMatchObject({ authors: [], score: 0, place: null, title: "third-agent" });
    expect(errors).toHaveLength(3);
    expect(validateChecks("nonsense").errors).toEqual(["checks must be a list"]);
  });

  it("drops logins that are not logins and control characters in text", () => {
    const { ok } = validateChecks([row("sample-service", { authors: ["alice", "not a login", 7], feedback: "sharp\u0000 checks" })]);
    expect(ok[0].authors).toEqual(["alice"]);
    expect(ok[0].feedback).toBe("sharp  checks");
  });

  it("merges rows by repo and keeps the first time", () => {
    const one = mergeChecks(EMPTY_CHECKS, validateChecks([row("sample-service"), row("example-agent")]).ok, "2026-11-17T12:30:00Z");
    const two = mergeChecks(one, validateChecks([row("sample-service", { llm: 9 })]).ok, "2026-11-17T14:00:00Z");
    expect(two.candidates.map((c) => [c.repo, c.llm, c.firstAt])).toEqual([
      ["example-agent", 4, "2026-11-17T12:30:00Z"],
      ["sample-service", 9, "2026-11-17T12:30:00Z"],
    ]);
  });

  it("gives a place to one repo at a time", () => {
    let doc = mergeChecks(EMPTY_CHECKS, validateChecks([row("sample-service"), row("example-agent")]).ok, "2026-11-17T12:30:00Z");
    doc = setPlace(doc, "sample-service", 1, "t1");
    doc = setPlace(doc, "example-agent", 2, "t2");
    expect(doc.places).toEqual({ "sample-service": 1, "example-agent": 2 });
    doc = setPlace(doc, "example-agent", 1, "t3"); // the first place moves
    expect(doc.places).toEqual({ "example-agent": 1 });
    doc = setPlace(doc, "example-agent", null, "t4");
    expect(doc.places).toEqual({});
  });

  it("reads anything that is not a document as empty", () => {
    expect(toChecksDoc(null)).toEqual(EMPTY_CHECKS);
    expect(toChecksDoc({ candidates: "x" })).toEqual(EMPTY_CHECKS);
    expect(toChecksDoc({ candidates: [], places: {}, updatedAt: 5 })).toEqual({ candidates: [], places: {}, updatedAt: null });
  });
});
