import { describe, expect, it } from "vitest";
import { DEFAULT_VIEW, VIEWS, resolveView } from "./views";

describe("visualisations", () => {
  it("each has its own id, a name for the switch, a title and an explanation", () => {
    expect(new Set(VIEWS.map((v) => v.id)).size).toBe(VIEWS.length);
    for (const v of VIEWS) {
      expect(v.label.length).toBeGreaterThan(0);
      expect(v.title.length).toBeGreaterThan(0);
      expect(v.about.length).toBeGreaterThan(40);
    }
    expect(new Set(VIEWS.map((v) => v.title)).size).toBe(VIEWS.length);
  });

  it("opens the first view for a missing or unknown id, so a removed view never breaks a link", () => {
    expect(resolveView(undefined).id).toBe(DEFAULT_VIEW);
    expect(resolveView(null).id).toBe(DEFAULT_VIEW);
    expect(resolveView("removed-long-ago").id).toBe(DEFAULT_VIEW);
    for (const v of VIEWS) expect(resolveView(v.id)).toBe(v);
  });
});
