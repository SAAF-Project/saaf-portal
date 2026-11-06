import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { loadManifests } from "../../lib/visualisations";
import { REGISTRY, buildViews, displayOptionsOf, findView } from "./views";
import { parseManifest, TOUR_TARGETS } from "./visualisation";
import type { ProgressData } from "./types";

const manifests = loadManifests();
const views = buildViews(manifests);
const data = JSON.parse(readFileSync(resolve(process.cwd(), "public/data/progress.json"), "utf8")) as ProgressData;

describe("visualisations", () => {
  it("every registered view has a visualization.yaml and the other way round", () => {
    expect(manifests.map((m) => m.id).sort()).toEqual(REGISTRY.map((r) => r.id).sort());
    expect(views.map((v) => v.id)).toEqual(REGISTRY.map((r) => r.id));
  });

  it("each has its own id, a name for the switch, a title, a tile text, a preview and a tour", () => {
    expect(new Set(views.map((v) => v.id)).size).toBe(views.length);
    expect(new Set(views.map((v) => v.title)).size).toBe(views.length);
    for (const v of views) {
      expect(v.name.length).toBeGreaterThan(0);
      expect(v.title.length).toBeGreaterThan(0);
      expect(v.description.length).toBeGreaterThan(20);
      expect(v.previewUrl.length).toBeGreaterThan(0);
      expect(v.access).toBe("community");
      expect(v.tour.length).toBeGreaterThan(2);
      expect(v.calculation.length).toBeGreaterThan(0);
    }
  });

  it("a tour only points at blocks that exist in the data and at places the page really has", () => {
    const parts = new Set(data.parts.map((p) => p.id));
    for (const v of views) {
      for (const step of v.tour) {
        if (step.target) expect(TOUR_TARGETS).toContain(step.target);
        if (step.focus?.level === "part") expect(parts.has(step.focus.partId), `${v.id}: ${step.title}`).toBe(true);
      }
      // a tour that needs the Display menu only makes sense when the view has one
      if (!displayOptionsOf(v).length) expect(v.tour.some((s) => s.target === "display"), `${v.id} has no Display menu`).toBe(false);
    }
  });

  it("only the Agent dependencies view shows the relations, and none of the texts mention another view", () => {
    expect(views.filter((v) => v.supports.relations).map((v) => v.id)).toEqual(["dependencies"]);
    const words: Record<string, RegExp> = { temple: /\btemple\b/i, islands: /\b(island|islands|archipelago)\b/i };
    for (const v of views) {
      const own = [v.description, ...v.calculation].join(" ");
      for (const [other, re] of Object.entries(words)) {
        if (v.id !== other) expect(re.test(own), `${v.id} mentions ${other}`).toBe(false);
      }
    }
  });

  it("offers Scenery only where the view has scenery", () => {
    expect(displayOptionsOf(findView(views, "temple")!)).toEqual(["scenery", "style"]);
    expect(displayOptionsOf(findView(views, "islands")!)).toEqual(["scenery", "style"]);
    expect(displayOptionsOf(findView(views, "dependencies")!)).toEqual(["style"]);
  });

  it("finds a view by id and says nothing for a missing or unknown one, so the chooser shows instead", () => {
    expect(findView(views, undefined)).toBeUndefined();
    expect(findView(views, null)).toBeUndefined();
    expect(findView(views, "removed-long-ago")).toBeUndefined();
    for (const v of views) expect(findView(views, v.id)).toBe(v);
  });
});

describe("visualization.yaml checks", () => {
  const ok = { id: "x", name: "X", title: "X view", description: "A view of the data.", preview: "p.jpg", tour: [{ title: "a", text: "b" }] };

  it("accepts the smallest valid file and fills in the defaults", () => {
    const m = parseManifest(ok, "x.yaml");
    expect(m.access).toBe("community");
    expect(m.supports).toEqual({ filters: true, display: [], relations: false });
    expect(m.calculation).toEqual([]);
  });

  it.each([
    ["an unknown field", { ...ok, colour: "red" }, /unknown field "colour"/],
    ["a bad id", { ...ok, id: "Not OK" }, /"id" must be lowercase/],
    ["an access level that is not supported yet", { ...ok, access: "members" }, /"access" must be "community"/],
    ["an unknown display option", { ...ok, supports: { display: ["glitter"] } }, /supports.display/],
    ["no tour", { ...ok, tour: [] }, /needs at least one step/],
    ["an unknown tour target", { ...ok, tour: [{ title: "a", text: "b", target: "moon" }] }, /"target" must be one of/],
    ["a part focus without a part", { ...ok, tour: [{ title: "a", text: "b", focus: { level: "part" } }] }, /"focus" must be level/],
    ["a missing title", { ...ok, title: "" }, /"title" must be a non-empty text/],
  ])("rejects %s and names the file", (_what, raw, message) => {
    expect(() => parseManifest(raw, "views/x/visualization.yaml")).toThrow(message);
    expect(() => parseManifest(raw, "views/x/visualization.yaml")).toThrow(/views\/x\/visualization.yaml/);
  });
});
