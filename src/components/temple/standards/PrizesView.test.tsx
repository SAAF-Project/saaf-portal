import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { LeaderboardPayload, PersonRow, RepoRow } from "../../../lib/leaderboard-day";
import PrizesView, { RULES } from "./PrizesView";

const base: LeaderboardPayload = {
  phase: "during",
  view: "public",
  start: "2026-11-17T08:00:00Z",
  end: "2026-11-17T15:15:00Z",
  freeze: "2026-11-17T14:15:00Z",
  computed_at: "2026-11-17T11:00:00Z",
  frozen: false,
  reveal: null,
  best_agent: [],
  most_improved: [],
  top_contributor: [],
  proposals: [],
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

  it("before the day: the three prizes and the rules", () => {
    const t = text({ ...base, phase: "before", totals: null });
    expect(t).toContain("best agent, most improved and top contributor");
    expect(t).toContain("How you get on the leaderboard.");
    expect(RULES).toHaveLength(12);
    expect(RULES.join(" ")).not.toContain("16:45");
  });

  it("during the day: best agent large, most improved, people with what they added, and the feed", () => {
    const t = text({
      ...base,
      best_agent: [repo("sample-service", 10, 30, ["alice"]), repo("example-agent", 8, 20)],
      most_improved: [repo("sample-service", 10, 30, ["alice"])],
      top_contributor: [person("alice", 12)],
      feed: [{ at: "2026-11-17T10:42:00Z", login: "alice", repo: "sample-service", changes: [{ standard: "readme", from: 1, to: 3 }], pending: false, url: null }],
    });
    expect(t).toContain("Best agent");
    expect(t).toContain("sample-service");
    expect(t).toContain("30 points · +20 today");
    expect(t).toContain("@alice in 1 repo");
    expect(t).toContain("sample-service · README.md 1 → 3");
    expect(t).toContain("+30 points added since");
    expect(t).toContain("@alice in sample-service README.md 1 → 3");
  });

  it("frozen: hidden places say when they are revealed, the feed waits", () => {
    const t = text({
      ...base,
      frozen: true,
      best_agent: [repo("?", 0, 0, [], true)],
      top_contributor: [person("?", 0, true), person("bob", 3)],
      feed: [{ at: "2026-11-17T14:40:00Z", login: "carol", repo: "sample-service", changes: [], pending: true, url: null }],
    });
    expect(t).toContain("Frozen at");
    expect(t).toContain("Revealed at the prize-giving.");
    expect(t).toContain("Landed. Judged at the reveal.");
    expect(t).toContain("@bob");
  });

  it("lists the best additions to the standards with their score", () => {
    const t = text({ ...base, proposals: [{ title: "Name the data residency in the README", author: "alice", url: "https://github.com/SAAF-Project/agent-template/pull/3", kind: "change", repo: "agent-template", score: 12 }] });
    expect(t).toContain("Best additions to the standards.");
    expect(t).toContain("Name the data residency in the README");
    expect(t).toContain("@alice · agent-template · change");
    expect(t).toContain("12/15");
  });

  it("the reveal: says how far it is", () => {
    const t = text({ ...base, phase: "after", reveal: { step: 3, total: 13 } });
    expect(t).toContain("The reveal: 3 of 13 places");
  });
});
