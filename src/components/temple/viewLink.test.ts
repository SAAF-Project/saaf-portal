import { describe, expect, it } from "vitest";
import { splitHash, startingView, viewFromHash } from "./viewLink";

const ids = ["temple", "islands", "dependencies"];

describe("which view a visit opens", () => {
  it("shows the chooser to a first-time visitor with a clean link", () => {
    expect(startingView(ids, "", null)).toBeNull();
    expect(startingView(ids, "#/", null)).toBeNull();
  });

  it("opens the view the link asks for, before anything remembered", () => {
    expect(startingView(ids, "#/?view=islands", "temple")).toBe("islands");
    expect(startingView(ids, "#/part/planning?view=dependencies", null)).toBe("dependencies");
  });

  it("shows the chooser for view=all, even when a view was picked before (navbar: All views)", () => {
    expect(startingView(ids, "#/?view=all", "temple")).toBeNull();
    expect(startingView(ids, "#/?view=all", null)).toBeNull();
  });

  it("opens the view a person picked before", () => {
    expect(startingView(ids, "", "islands")).toBe("islands");
    expect(startingView(ids, "#/", "dependencies")).toBe("dependencies");
  });

  it("ignores a view that no longer exists, so a removed view never breaks a link", () => {
    expect(startingView(ids, "#/?view=removed", null)).toBeNull();
    expect(startingView(ids, "", "removed")).toBeNull();
  });

  it("still opens the first view for an old link to a block or with filters (made before the chooser)", () => {
    expect(startingView(ids, "#/part/planning", null)).toBe("temple");
    expect(startingView(ids, "#/?stage=2", null)).toBe("temple");
    expect(startingView(ids, "#/annex", null)).toBe("temple");
  });

  it("reads the view and the place from a link", () => {
    expect(viewFromHash("#/part/x?stage=2&view=islands")).toBe("islands");
    expect(viewFromHash("#/")).toBeNull();
    expect(splitHash("#/part/x?stage=2")).toEqual(["/part/x", "stage=2"]);
  });
});
