import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { PrizesPayload } from "../../../lib/standards-prizes";
import PrizesView from "./PrizesView";

const base: PrizesPayload = {
  phase: "during",
  start: "2026-11-17T08:00:00Z",
  end: "2026-11-17T15:15:00Z",
  computed_at: "2026-11-17T11:00:00Z",
  first_nine: [],
  biggest_jump: [],
  new_repos: [],
  tiles: { start: 196, now: 212 },
  unread: 0,
};
const row = (name: string, before: number, after: number, by: string[] = [], reached_at: string | null = null) => ({
  name,
  url: `https://github.com/SAAF-Project/${name}`,
  before,
  after,
  jump: after - before,
  reached_at,
  by,
});
const text = (p: PrizesPayload | null) => renderToStaticMarkup(<PrizesView payload={p} />).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

describe("prizes panel", () => {
  it("draws nothing without data", () => {
    expect(renderToStaticMarkup(<PrizesView payload={null} />)).toBe("");
  });

  it("before the day: says when counting starts, and lists nothing", () => {
    const t = text({ ...base, phase: "before", tiles: null });
    expect(t).toContain("Counting starts at");
    expect(t).not.toContain("Biggest jump");
  });

  it("during the day: the leaders of both prizes, who made the difference, and the new repos", () => {
    const t = text({
      ...base,
      first_nine: [row("sample-service", 3, 9, ["alice", "bob"], "2026-11-17T10:42:00Z")],
      biggest_jump: [row("sample-service", 3, 9, ["alice", "bob"]), row("example-agent", 2, 5)],
      new_repos: [{ name: "fresh-agent", url: "https://github.com/SAAF-Project/fresh-agent", met: 9 }],
    });
    expect(t).toContain("Live since");
    expect(t).toContain("196 tiles at");
    expect(t).toContain("@alice · @bob");
    expect(t).toContain("+6 (3→9)");
    expect(t).toContain("+3 (2→5)");
    expect(t).toContain("fresh-agent 9/9");
  });

  it("after the day: marked final, and says when a repo could not be read", () => {
    const t = text({ ...base, phase: "after", unread: 2 });
    expect(t).toContain("Final, counted at");
    expect(t).toContain("2 repos not read yet");
    expect(t).toContain("No repo has all nine yet.");
  });
});
