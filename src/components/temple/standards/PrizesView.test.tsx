import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { LeaderboardPayload, PersonRow, RepoRow } from "../../../lib/leaderboard-day";
import PrizesView, { RULES, SHORT_RULES } from "./PrizesView";

const base: LeaderboardPayload = {
  phase: "during",
  view: "public",
  start: "2026-11-17T08:00:00Z",
  end: "2026-11-17T15:15:00Z",
  freeze: "2026-11-17T14:15:00Z",
  computed_at: "2026-11-17T11:00:00Z",
  frozen: false,
  reveal: null,
  prize: "most_improved",
  best_agent: [],
  most_improved: [],
  top_contributor: [],
  proposals: [],
  checks: [],
  checks_total: 0,
  feed: [],
  fresh: {},
  totals: { start: 100, now: 130, max: 500 },
  graded: { states: 10, pending: 2, last_at: "2026-11-17T12:30:00Z" },
  unread: 0,
};
const repo = (name: string, before: number, after: number, by: string[] = [], masked = false): RepoRow => ({
  name,
  url: `https://github.com/SAAF-Project/${name}`,
  made_today: false,
  before,
  after,
  gain: after - before,
  by,
  levels: { readme: 3, tests: 2 },
  masked,
});
const person = (login: string, points: number, masked = false): PersonRow => ({
  login,
  points,
  capped: 0,
  repos: ["sample-service"],
  contributions: [{ login, repo: "sample-service", standard: "readme", from: 1, to: 3, points: 8, at: "2026-11-17T10:42:00Z", url: "https://github.com/SAAF-Project/sample-service/pull/7" }],
  masked,
});
const html = (p: LeaderboardPayload | null) => renderToStaticMarkup(<PrizesView payload={p} />);
const text = (p: LeaderboardPayload | null) => html(p).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

describe("the day's leaderboard", () => {
  it("draws nothing without data", () => {
    expect(html(null)).toBe("");
  });

  it("before the day: the three tracks with how you win, and the rules one click away", () => {
    const t = text({ ...base, phase: "before", totals: null });
    expect(t).toContain("Three tracks, three winners.");
    for (const name of ["Harden an agent.", "Improve a standard.", "Write LLM checks."]) expect(t).toContain(name);
    expect(t).toContain("EUR 200 in Orq.ai credits each");
    expect(t).toContain("The rules.");
    expect(html({ ...base, phase: "before", totals: null })).not.toContain("<details open");
    expect(SHORT_RULES).toHaveLength(5);
    expect(RULES).toHaveLength(14);
    expect(RULES.join(" ")).not.toContain("16:45");
    expect([...RULES, ...SHORT_RULES].join(" ").toLowerCase()).not.toContain("red team");
  });

  it("during the day: who leads each track, the list of track 1, and the rest folded away", () => {
    const t = text({
      ...base,
      best_agent: [repo("example-agent", 20, 34, ["bob"]), repo("sample-service", 10, 30, ["alice"])],
      most_improved: [repo("sample-service", 10, 30, ["alice"])],
      top_contributor: [person("alice", 12)],
      feed: [{ at: "2026-11-17T10:42:00Z", login: "alice", repo: "sample-service", changes: [{ standard: "readme", from: 1, to: 3 }], pending: false, url: null }],
    });
    expect(t).toContain("+20 points today · @alice"); // the leader of track 1 is the biggest rise, with who did it
    expect(t).toContain("Track 1 · Most quality added.");
    expect(t).toContain("Also today, without a prize.");
    expect(t).toContain("34 points · +14 today"); // best agent, a mention
    expect(t).toContain("@alice in 1 repo");
    expect(t).toContain("sample-service · README.md 1 → 3");
    expect(t).toContain("+30 points since");
    expect(t).toContain("@alice in sample-service README.md 1 → 3");
  });

  it("with best agent as the prize of track 1, that list leads", () => {
    const t = text({ ...base, prize: "best_agent", best_agent: [repo("example-agent", 20, 34, ["bob"])], most_improved: [repo("sample-service", 10, 30, ["alice"])] });
    expect(t).toContain("Track 1 · Best agent.");
    expect(t).toContain("34 points, +14 today · @bob");
  });

  it("frozen: hidden places say when they are revealed, the feed waits", () => {
    const t = text({
      ...base,
      frozen: true,
      most_improved: [repo("?", 0, 0, [], true)],
      top_contributor: [person("?", 0, true), person("bob", 3)],
      feed: [{ at: "2026-11-17T14:40:00Z", login: "carol", repo: "sample-service", changes: [], pending: true, url: null }],
    });
    expect(t).toContain("Frozen at");
    expect(t).toContain("Revealed at 17:00.");
    expect(t).toContain("? · revealed at 17:00");
    expect(t).toContain("Landed. Judged at the reveal.");
    expect(t).toContain("@bob");
  });

  it("track 2: lists the best additions to the standards with their score", () => {
    const t = text({ ...base, proposals: [{ title: "Name the data residency in the README", author: "alice", url: "https://github.com/SAAF-Project/agent-template/pull/3", kind: "change", repo: "agent-template", score: 12 }] });
    expect(t).toContain("Track 2 · Best additions to the standards.");
    expect(t).toContain("Name the data residency in the README");
    expect(t).toContain("@alice · agent-template · change");
    expect(t).toContain("12/15");
  });

  it("track 3: how many repos have LLM checks, and the jury's places only in the reveal", () => {
    const check = (name: string, llm: number, place?: number, masked = false) => ({ repo: name, url: `https://github.com/SAAF-Project/${name}`, authors: ["alice"], llm, code: 1, ...(place ? { place } : {}), masked });
    const day = text({ ...base, checks: [check("sample-service", 4), check("example-agent", 1)], checks_total: 2 });
    expect(day).toContain("2 repos have LLM checks");
    expect(day).toContain("The jury picks the winner at 16:15.");
    expect(day).toContain("4 checks");
    expect(day).toContain("1 check ");
    const reveal = text({ ...base, phase: "after", reveal: { step: 3, total: 11 }, checks: [check("?", 0, undefined, true), check("sample-service", 4, 2)], checks_total: 2 });
    expect(reveal).toContain("The reveal: step 3 of 11");
    expect(reveal).toContain("02 sample-service");
    const done = text({ ...base, phase: "after", reveal: { step: 11, total: 11 }, checks: [check("example-agent", 1, 1), check("sample-service", 4, 2)], checks_total: 2 });
    expect(done).toContain("01 example-agent");
  });
});
