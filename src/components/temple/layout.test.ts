import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { withAnnexPart } from "./derive";
import { Cell, computeLayout, polyArea, roofBandPolygon, tileRect, triangleCounts, type RoofBody } from "./layout";
import { STAGES, byMaturity, stageCounts, stageOf, stageSegments } from "./stages";
import type { ProgressData } from "./types";

const raw = JSON.parse(readFileSync(resolve(process.cwd(), "public/data/progress.json"), "utf8")) as ProgressData;
const data = withAnnexPart(raw);
const layout = computeLayout(data);

// Visible face area: the front (x*y) for pillars, roof and annex; the top (x*z) for the foundation tiles.
const faceArea = (c: Cell) =>
  c.geom.type === "poly" ? polyArea(c.geom.points) : c.partId === "foundation" ? c.geom.size[0] * c.geom.size[2] : c.geom.size[0] * c.geom.size[1];

describe("tileRect", () => {
  it.each([1, 2, 5, 6, 7, 11, 13, 15, 40])("tiles a rectangle with %i cells of equal area, without gaps", (n) => {
    const rects = tileRect(n, 3.8, 6.2);
    expect(rects).toHaveLength(n);
    const areas = rects.map((r) => (r.u1 - r.u0) * (r.v1 - r.v0));
    areas.forEach((a) => expect(a).toBeCloseTo((3.8 * 6.2) / n, 9));
    expect(areas.reduce((s, a) => s + a, 0)).toBeCloseTo(3.8 * 6.2, 9);
  });
});

describe("layout of the real data", () => {
  it("places every plan of every part exactly once", () => {
    for (const part of data.parts) {
      const target = part.id === "annex" ? layout.annexCells : layout.cells;
      const placed = Object.values(target).filter((c) => c.partId === part.id).map((c) => c.slug).sort();
      expect(placed, part.id).toEqual([...part.plans].sort());
    }
  });

  it("gives all cells of a part the same surface area, which fills the part", () => {
    for (const part of data.parts) {
      if (!part.plans.length) continue;
      const cells = Object.values(part.id === "annex" ? layout.annexCells : layout.cells).filter((c) => c.partId === part.id);
      const areas = cells.map(faceArea);
      areas.forEach((a) => expect(a, `${part.id} cell`).toBeCloseTo(areas[0], 6));
    }
  });

  it("keeps the three layers apart: foundation < pillars < roof", () => {
    expect(layout.pillarBaseY).toBeGreaterThan(0.6 + 0.3);
    expect(layout.roofBaseY).toBeGreaterThan(layout.pillarTopY + 0.3);
  });

  it("puts the beam in the roof part: the roof's plans include box (beam) and polygon (pediment) pieces", () => {
    const roof = Object.values(layout.cells).filter((c) => c.partId === "governance");
    expect(roof.some((c) => c.geom.type === "box")).toBe(true);
    expect(roof.some((c) => c.geom.type === "poly")).toBe(true);
  });

  it("orders plans red at the bottom growing to green at the top (pillars)", () => {
    const part = data.parts.find((p) => p.kind === "pillar")!;
    const cells = part.plans.map((s) => layout.cells[s]);
    const stageAt = (c: Cell) => stageOf(data.plans.find((p) => p.slug === c.slug)!).id;
    // row by row from the bottom, left to right inside a row
    const sorted = [...cells].sort((a, b) => Math.round(a.pos[1] * 1e6) - Math.round(b.pos[1] * 1e6) || a.pos[0] - b.pos[0]);
    for (let i = 1; i < sorted.length; i++) expect(stageAt(sorted[i])).toBeGreaterThanOrEqual(stageAt(sorted[i - 1]));
  });
});

describe("roof bands", () => {
  const roof = layout.bodies["governance"] as RoofBody;
  const total = roofBandPolygon(roof, 0, 1);

  it("slices the roof into pieces whose areas follow the fractions", () => {
    for (const [f0, f1] of [[0, 0.25], [0.25, 0.5], [0.3, 0.9], [0.5, 1], [0, 1]]) {
      expect(polyArea(roofBandPolygon(roof, f0, f1)) / polyArea(total)).toBeCloseTo(f1 - f0, 6);
    }
  });

  it("has equal-area pieces in beam and pediment", () => {
    const cells = Object.values(layout.cells).filter((c) => c.partId === "governance");
    const areas = cells.map(faceArea);
    areas.forEach((a) => expect(a).toBeCloseTo(areas[0], 6));
    expect(areas.reduce((s, a) => s + a, 0)).toBeCloseTo(polyArea(total), 6);
  });

  it("splits plan counts over the pediment rows", () => {
    expect(triangleCounts(9)).toEqual([1, 3, 5]);
    expect(triangleCounts(14).reduce((a, b) => a + b, 0)).toBe(14);
  });
});

describe("stages", () => {
  it("reads the stage the generator decided, and both sides define the same stages", () => {
    expect(STAGES.map((s) => s.id)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(STAGES.map((s) => s.key)).toEqual(data.stages.map((s) => s.key));
    expect(STAGES.map((s) => s.label)).toEqual(data.stages.map((s) => s.label));
    for (const p of data.plans) {
      expect(stageOf(p).key, p.slug).toBe(p.stage_key);
      expect(stageOf(p).id, p.slug).toBe(p.stage);
    }
  });

  it("keeps the stage names free of any one kind of plan", () => {
    for (const s of STAGES) expect(`${s.label} ${s.hint}`.toLowerCase(), s.key).not.toContain("agent");
  });

  it("falls back to the first stage for an unknown stage number", () => {
    expect(stageOf({ stage: 99 }).key).toBe("draft-plan");
  });

  it("counts stages least mature first (red to green) and covers every plan", () => {
    const counts = stageCounts(data.plans);
    expect(counts.reduce((s, c) => s + c.count, 0)).toBe(data.plans.length);
    const ids = counts.map((c) => c.stage.id);
    expect(ids).toEqual([...ids].sort((a, b) => a - b));
  });

  it("splits each stage band into matching and faded plans, keeping the total", () => {
    const all = stageSegments(data.plans, () => true);
    expect(all.every((s) => !s.ghost)).toBe(true);
    expect(all.map((s) => [s.stage.id, s.count])).toEqual(stageCounts(data.plans).map((c) => [c.stage.id, c.count]));
    const onlyBuilding = stageSegments(data.plans, (p) => stageOf(p).key === "building");
    expect(onlyBuilding.reduce((n, s) => n + s.count, 0)).toBe(data.plans.length);
    expect(onlyBuilding.filter((s) => !s.ghost).every((s) => s.stage.key === "building")).toBe(true);
    const none = stageSegments(data.plans, () => false);
    expect(none.every((s) => s.ghost)).toBe(true);
  });

  it("sorts plans least mature first", () => {
    const sorted = [...data.plans].sort(byMaturity);
    for (let i = 1; i < sorted.length; i++) expect(sorted[i].stage).toBeGreaterThanOrEqual(sorted[i - 1].stage);
  });
});
