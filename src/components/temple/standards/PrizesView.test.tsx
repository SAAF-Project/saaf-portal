import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { PrizeRow, PrizesPayload } from "../../../lib/standards-prizes";
import PrizesView, { RULES } from "./PrizesView";
import { STANDARDS } from "./standards";

const IDS = STANDARDS.map((s) => s.id);
const base: PrizesPayload = {
  phase: "during",
  start: "2026-11-17T08:00:00Z",
  end: "2026-11-17T15:15:00Z",
  computed_at: "2026-11-17T11:00:00Z",
  first_nine: [],
  closest: [],
  biggest_jump: [],
  people: [],
  people_total: 0,
  finished: 0,
  new_repos: [],
  standards: { start: 196, now: 212 },
  fresh: {},
  unread: 0,
};
const row = (name: string, before: number, after: number, by: string[] = [], reached_at: string | null = null): PrizeRow => ({
  name,
  url: `https://github.com/SAAF-Project/${name}`,
  before,
  after,
  jump: after - before,
  reached_at,
  settled_at: reached_at,
  by,
  had: IDS.slice(0, before),
  added: IDS.slice(before, after),
});
const html = (p: PrizesPayload | null) => renderToStaticMarkup(<PrizesView payload={p} />);
const text = (p: PrizesPayload | null) => html(p).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

describe("the day's leaderboard", () => {
  it("draws nothing without data", () => {
    expect(html(null)).toBe("");
  });

  it("before the day: says when counting starts, and shows the rules", () => {
    const t = text({ ...base, phase: "before", standards: null });
    expect(t).toContain("Counting starts at");
    expect(t).toContain("How you get on the leaderboard.");
    for (const rule of RULES) expect(t).toContain(rule.replace(/'/g, "&#x27;").slice(0, 40));
    expect(t).not.toContain("Biggest jump");
  });

  it("during the day: the first prize large, with the second it was reached and who did it", () => {
    const t = text({
      ...base,
      first_nine: [row("sample-service", 3, 9, ["alice", "bob"], "2026-11-17T10:42:07Z"), row("example-agent", 5, 9, [], "2026-11-17T11:00:00Z")],
      finished: 2,
    });
    expect(t).toContain("First prize");
    expect(t).toContain("sample-service");
    expect(t).toMatch(/All nine at \d\d:42:07 · \+6 since/);
    expect(t).toContain("@alice");
    expect(t).toContain("@bob");
    expect(t).toMatch(/02 example-agent \d\d:00:00/);
    expect(t).toContain("2 agents reached all nine today");
  });

  it("before anyone has all nine: names the closest repos", () => {
    const t = text({ ...base, closest: [row("example-agent", 2, 8), row("sample-service", 1, 7)] });
    expect(t).toContain("Nobody has all nine yet.");
    expect(t).toContain("Closest now: example-agent , 8 of 9.");
    expect(t).toContain("sample-service · 7 of 9");
  });

  it("the biggest jumps, the people who added most, and the new repos", () => {
    const p: PrizesPayload = {
      ...base,
      biggest_jump: [row("sample-service", 3, 9, ["alice", "bob"]), row("example-agent", 2, 5)],
      people: [
        { login: "alice", added: 7, repos: ["sample-service", "example-agent"], last_at: "2026-11-17T10:00:00Z" },
        { login: "bob", added: 1, repos: ["sample-service"], last_at: "2026-11-17T10:00:00Z" },
      ],
      people_total: 2,
      new_repos: [{ name: "fresh-agent", url: "https://github.com/SAAF-Project/fresh-agent", met: 9 }],
    };
    const t = text(p);
    expect(t).toContain("+16 standards added since");
    expect(t).toContain("2 people on the board");
    expect(t).toContain("@alice · @bob");
    expect(t).toContain("+6 3 → 9");
    expect(t).toContain("+3 2 → 5");
    expect(t).toContain("@alice in 2 repos 7");
    expect(t).toContain("@bob in 1 repo 1");
    expect(t).toContain("fresh-agent 9/9");
    // what came in today glows in the small faces: six for sample-service, three for example-agent
    expect(html(p).match(/std-glow/g)).toHaveLength(9);
  });

  it("after the day: marked final, and says when a repo could not be read", () => {
    const t = text({ ...base, phase: "after", unread: 2 });
    expect(t).toContain("Final, counted at");
    expect(t).toContain("2 repos not read yet");
    expect(t).toContain("Nobody reached all nine.");
  });
});
