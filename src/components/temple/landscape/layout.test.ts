import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { withAnnexPart } from "../derive";
import type { PlanRecord, ProgressData } from "../types";
import { SLOT_SPACING, computeLandscape, needsSimplerObjects, pointInPolygon, slotOf, type LandscapeLayout } from "./layout";

const data = withAnnexPart(JSON.parse(readFileSync(resolve(process.cwd(), "public/data/progress.json"), "utf8")) as ProgressData);
const layout = computeLandscape(data);

/** The same data with many more plans, spread over the parts the way the real ones are. */
function grown(factor: number): ProgressData {
  const plans: PlanRecord[] = [];
  const parts = data.parts.map((p) => ({ ...p, plans: [] as string[] }));
  for (const plan of data.plans) {
    for (let i = 0; i < factor; i++) {
      const copy = { ...plan, slug: `${plan.slug}-${i}`, stage: (plan.stage + i) % 6 };
      plans.push(copy);
      parts.find((p) => p.id === plan.part)?.plans.push(copy.slug);
    }
  }
  const annex = parts.find((p) => p.id === "annex")!;
  annex.plans = data.annex.items.flatMap((item) => Array.from({ length: factor }, (_, i) => `${item.plan}-${i}`));
  parts.forEach((p) => (p.plan_count = p.plans.length));
  return { ...data, plans, parts, annex: { ...data.annex, items: data.annex.items.flatMap((item) => Array.from({ length: factor }, (_, i) => ({ ...item, plan: `${item.plan}-${i}` }))) } };
}

function overlaps(l: LandscapeLayout) {
  const ids = Object.keys(l.islands);
  const bad: string[] = [];
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const a = l.islands[ids[i]];
      const b = l.islands[ids[j]];
      // two ellipses overlap when their bounding boxes overlap in both directions (islands sit in rows, so this is exact enough)
      if (Math.abs(a.center[0] - b.center[0]) < a.rx + b.rx && Math.abs(a.center[1] - b.center[1]) < a.rz + b.rz) bad.push(`${ids[i]} / ${ids[j]}`);
    }
  }
  return bad;
}

describe("islands layout", () => {
  it("has an island for every part: governance behind, four stages in a row, infrastructure in front", () => {
    expect(Object.keys(layout.islands).sort()).toEqual(["annex", "collection", "foundation", "governance", "monitoring", "planning", "reporting"]);
    expect(layout.row).toEqual(["planning", "collection", "reporting", "monitoring"]);
    const xs = layout.row.map((id) => layout.islands[id].center[0]);
    expect([...xs].sort((a, b) => a - b)).toEqual(xs);
    expect(layout.islands.governance.center[1]).toBeLessThan(layout.islands.planning.center[1]);
    expect(layout.islands.foundation.center[1]).toBeGreaterThan(layout.islands.planning.center[1]);
  });

  it("puts every plan of a part on exactly one slot of its island, inside its shore", () => {
    for (const part of data.parts.filter((p) => p.plans.length > 0)) {
      const island = layout.islands[part.id];
      expect(island.slots.map((s) => s.slug).sort()).toEqual([...part.plans].sort());
      for (const s of island.slots) expect(pointInPolygon(s.pos, island.outline)).toBe(true);
    }
  });

  it("keeps objects apart, and islands apart", () => {
    for (const island of Object.values(layout.islands)) {
      for (let i = 0; i < island.slots.length; i++) {
        for (let j = i + 1; j < island.slots.length; j++) {
          const [a, b] = [island.slots[i].pos, island.slots[j].pos];
          expect(Math.hypot(a[0] - b[0], a[1] - b[1])).toBeGreaterThanOrEqual(SLOT_SPACING - 1e-3);
        }
      }
    }
    expect(overlaps(layout)).toEqual([]);
  });

  it("fills an island from the front: the least mature plans sit in front, the most mature at the back", () => {
    for (const island of Object.values(layout.islands)) {
      const stages = island.slots.map((s) => data.plans.find((p) => p.slug === s.slug)!.stage);
      for (let i = 1; i < stages.length; i++) expect(stages[i]).toBeGreaterThanOrEqual(stages[i - 1]);
      const zs = island.slots.map((s) => s.pos[1]);
      for (let i = 1; i < zs.length; i++) expect(zs[i]).toBeLessThanOrEqual(zs[i - 1] + 1e-9);
    }
  });

  it("keeps trees and buildings off the objects", () => {
    for (const island of Object.values(layout.islands)) {
      for (const t of island.trees) for (const s of island.slots) expect(Math.hypot(t[0] - s.pos[0], t[1] - s.pos[1])).toBeGreaterThan(SLOT_SPACING * 0.8);
      if (island.landmark) {
        for (const s of island.slots) {
          const inside = Math.abs(s.pos[0] - island.landmark.center[0]) < island.landmark.halfW && Math.abs(s.pos[1] - island.landmark.center[1]) < island.landmark.halfD;
          expect(inside).toBe(false);
        }
      }
    }
  });

  it("is deterministic", () => {
    expect(computeLandscape(data)).toEqual(layout);
  });

  it("finds a plan's slot", () => {
    const plan = data.plans[0];
    expect(slotOf(layout, plan.part, plan.slug)?.slug).toBe(plan.slug);
    expect(slotOf(layout, "planning", "nope")).toBeUndefined();
  });

  it("still lays everything out, without overlaps, with ten times as many plans", () => {
    const big = computeLandscape(grown(10));
    expect(overlaps(big)).toEqual([]);
    const total = Object.values(big.islands).reduce((n, i) => n + i.slots.length, 0);
    expect(total).toBeGreaterThan(Object.values(layout.islands).reduce((n, i) => n + i.slots.length, 0) * 9);
    for (const island of Object.values(big.islands)) for (const s of island.slots) expect(pointInPolygon(s.pos, island.outline)).toBe(true);
    // the first screen has to stay readable: the whole archipelago grows slower than the plans do
    const width = (l: LandscapeLayout) => l.bounds.maxX - l.bounds.minX;
    expect(width(big) / width(layout)).toBeLessThan(5);
  });

  it("switches to simple objects on the first screen only when there are very many plans", () => {
    expect(needsSimplerObjects(data.plans.length)).toBe(false);
    expect(needsSimplerObjects(500)).toBe(true);
  });
});
