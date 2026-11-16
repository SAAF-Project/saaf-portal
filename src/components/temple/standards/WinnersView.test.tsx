import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { CheckRow, LeaderboardPayload, PersonRow, ProposalRow, RepoRow } from "../../../lib/leaderboard-day";
import WinnersView, { announcement, podium, stagesShown, winnersStage } from "./WinnersView";

const base: LeaderboardPayload = {
  phase: "after",
  view: "public",
  start: "2026-11-17T08:00:00Z",
  end: "2026-11-17T15:15:00Z",
  freeze: "2026-11-17T14:15:00Z",
  computed_at: "2026-11-17T16:00:00Z",
  frozen: false,
  reveal: null,
  prize: "most_improved",
  best_agent: [],
  most_improved: [],
  top_contributor: [],
  proposals: [],
  checks: [],
  checks_total: 3,
  disqualified: 0,
  feed: [],
  fresh: {},
  totals: null,
  graded: { states: 10, pending: 0, last_at: null },
  unread: 0,
};
const HIDDEN_REPO: RepoRow = { name: "?", url: "", made_today: false, before: 0, after: 0, gain: 0, by: [], levels: {}, masked: true };
const repo = (name: string, before: number, after: number, by: string[]): RepoRow => ({ name, url: `https://github.com/SAAF-Project/${name}`, made_today: false, before, after, gain: after - before, by, levels: {} });
const person = (login: string, points: number, masked = false): PersonRow => ({ login: masked ? "?" : login, points, capped: 0, repos: [], contributions: [], masked });
const proposal = (title: string, author: string, score: number, masked = false): ProposalRow => (masked ? { title: "?", author: "?", url: "", kind: "", repo: "", score: 0, masked: true } : { title, author, url: `https://example.test/${author}`, kind: "change", repo: "agent-template", score });
const HIDDEN_CHECK: CheckRow = { repo: "?", url: "", authors: [], llm: 0, code: 0, place: null, masked: true };
const check = (name: string, place: number | null, authors: string[], jury?: CheckRow["jury"]): CheckRow => ({ repo: name, url: `https://github.com/SAAF-Project/${name}`, authors, llm: 5, code: 2, place, ...(jury ? { jury } : {}) });

const REPOS = [repo("quiet-agent", 4, 27, ["person-1", "person-2", "person-3", "person-4", "person-5"]), repo("sample-service", 10, 22, ["person-6"]), repo("example-agent", 12, 20, ["person-7"])];
const PEOPLE = [person("person-1", 21), person("person-6", 12), person("person-7", 8)];
const PROPOSALS = [proposal("README: name where the data goes", "person-8", 13), proposal("Fold observability into agent.yaml", "person-9", 11), proposal("A tenth standard", "person-10", 6)];
const SAID = { score: 14, max: 16, parts: { criteria: 4, fit: 3, tracing: 4, evals: 3 }, reason: "A check caught a real defect and a commit fixed it." };
const CHECKS = [check("ledger-agent", 1, ["person-11", "person-12"], SAID), check("claims-agent", 2, ["person-13"], { score: 11, max: 16, parts: {}, reason: "Clear pass rules." }), check("other-agent", null, ["person-14"])];

const html = (p: LeaderboardPayload | null, view?: Parameters<typeof WinnersView>[0]["view"]) => renderToStaticMarkup(<WinnersView payload={p} view={view} />);

describe("the winners view", () => {
  it("shows nothing of the day before the reveal starts, whatever the standings", () => {
    const during: LeaderboardPayload = { ...base, most_improved: REPOS, top_contributor: PEOPLE, proposals: PROPOSALS, checks: CHECKS };
    expect(winnersStage(during)).toEqual({ stage: "waiting", done: false });
    expect(stagesShown(during)).toEqual([]);
    const out = html(during, "agent"); // even when a part is asked for
    expect(out).toContain("The winners.");
    expect(out).toContain("Revealed at 17:00.");
    expect(out).not.toMatch(/quiet-agent|person-1|ledger-agent|README: name/);
    expect(html(null)).toContain("Revealed at 17:00.");
  });

  it("starts with the mentions", () => {
    const p: LeaderboardPayload = { ...base, reveal: { step: 1, total: 10 }, top_contributor: PEOPLE, best_agent: [HIDDEN_REPO, HIDDEN_REPO, HIDDEN_REPO], most_improved: [HIDDEN_REPO, HIDDEN_REPO, HIDDEN_REPO], proposals: [proposal("", "", 0, true)], checks: [HIDDEN_CHECK, HIDDEN_CHECK, CHECKS[2]] };
    expect(winnersStage(p).stage).toBe("mentions");
    const out = html(p);
    expect(out).toContain("Honourable mentions.");
    expect(out).toContain("@person-1");
    expect(out).not.toContain("ledger-agent");
    expect(stagesShown(p)).toEqual(["mentions"]);
  });

  it("builds a podium from the third place up: a hidden place shows its numeral only", () => {
    const p: LeaderboardPayload = { ...base, reveal: { step: 3, total: 9 }, top_contributor: PEOPLE, best_agent: REPOS, most_improved: [HIDDEN_REPO, HIDDEN_REPO, HIDDEN_REPO], proposals: [proposal("", "", 0, true)], checks: [HIDDEN_CHECK, CHECKS[1], CHECKS[2]], checks_jury: ["Judge One, Example"] };
    expect(winnersStage(p)).toEqual({ stage: "checks", done: false });
    expect(podium(p, "checks").map((s) => [s.place, s.entry?.title ?? null])).toEqual([[1, null], [2, "claims-agent"]]); // two places given: no third step
    const out = html(p);
    expect(out).toContain("Track 3 · Write LLM checks.");
    expect(out).toContain("The jury: Judge One, Example.");
    expect(out).toContain("claims-agent");
    expect(out).toContain("Clear pass rules.");
    expect(out).toContain(">P1<");
    expect(out).not.toContain(">P3<");
    expect(out).not.toMatch(/ledger-agent|other-agent|Wins EUR/);
    expect(out.indexOf("win-col-1")).toBeLessThan(out.indexOf("win-col-2")); // read in the order of the places
    expect(announcement(p, "checks")).toBe("Track 3, place 2: claims-agent.");
  });

  it("shows the winner of track 3 with the team, the prize and what the jury said", () => {
    const p: LeaderboardPayload = { ...base, reveal: { step: 4, total: 9 }, top_contributor: PEOPLE, best_agent: REPOS, most_improved: [HIDDEN_REPO, HIDDEN_REPO, HIDDEN_REPO], proposals: [proposal("", "", 0, true)], checks: CHECKS };
    const out = html(p);
    expect(out).toContain("ledger-agent");
    expect(out).toContain("@person-11");
    expect(out).toContain("Wins EUR 200 · EUR 100 each");
    expect(out).toContain("Jury: 14/16 · criteria 4 · fit 3 · tracing 4 · evals 3");
    expect(out).toContain("A check caught a real defect and a commit fixed it.");
    expect(announcement(p, "checks")).toBe("Track 3, place 1: ledger-agent.");
  });

  it("follows the prize-giving to track 1, names four of a larger team, and ends with the three winners together", () => {
    const end: LeaderboardPayload = { ...base, reveal: { step: 10, total: 10 }, top_contributor: PEOPLE, best_agent: REPOS, most_improved: REPOS, proposals: PROPOSALS, checks: CHECKS };
    expect(winnersStage(end)).toEqual({ stage: "agent", done: true });
    expect(stagesShown(end)).toEqual(["mentions", "checks", "standard", "agent", "all"]);
    const last = html(end);
    expect(last).toContain("Track 1 · Harden an agent.");
    expect(last).toContain("+23 points today · from 4 to 27");
    expect(last).toContain("@person-4");
    expect(last).not.toContain("@person-5");
    expect(last).toContain("+1"); // the fifth name
    expect(last).toContain("Wins EUR 200 · EUR 50 each for @person-1 @person-2 @person-3 @person-4");

    const all = html(end, "all");
    expect(all).toContain("The winners of the hardening day.");
    for (const name of ["quiet-agent", "README: name where the data goes", "ledger-agent"]) expect(all).toContain(name);
    expect(all).toContain("Top contributor: @person-1 · Best agent: quiet-agent");
    expect(announcement(end, "all")).toBe("The winners: quiet-agent, README: name where the data goes, ledger-agent.");

    const mid: LeaderboardPayload = { ...end, reveal: { step: 6, total: 10 }, most_improved: [HIDDEN_REPO, HIDDEN_REPO, HIDDEN_REPO], proposals: [proposal("", "", 0, true), PROPOSALS[1], PROPOSALS[2]] };
    expect(winnersStage(mid)).toEqual({ stage: "standard", done: false });
    expect(html(mid)).toContain("Track 2 · Improve a standard.");
  });
});
