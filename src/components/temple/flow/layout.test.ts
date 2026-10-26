import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { withAnnexPart } from "../derive";
import { BUNDLED_RELATIONS, cleanRelations } from "../relations";
import type { ProgressData } from "../types";
import { computeFlow } from "./layout";

const data = withAnnexPart(JSON.parse(readFileSync(resolve(process.cwd(), "public/data/progress.json"), "utf8")) as ProgressData);
const { edges } = cleanRelations(BUNDLED_RELATIONS.relations, data.plans);
const linked = new Set(edges.flatMap((e) => [e.from, e.to]));

const overlap = (a: { x: number; y: number; w: number; h: number }, b: typeof a) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

describe("dependency map layout", () => {
  for (const showUnlinked of [false, true]) {
    it(`never lets two cards overlap (${showUnlinked ? "with" : "without"} the plans without relations)`, () => {
      const cards = Object.values(computeFlow(data.plans, data.parts, edges, { showUnlinked }).cards);
      for (let i = 0; i < cards.length; i++) for (let j = i + 1; j < cards.length; j++) expect(overlap(cards[i], cards[j]), `${cards[i].slug} / ${cards[j].slug}`).toBe(false);
    });
  }

  it("hides plans without relations unless asked, and always shows the selected one", () => {
    const loose = data.plans.find((p) => !linked.has(p.slug))!;
    const hidden = computeFlow(data.plans, data.parts, edges, { showUnlinked: false });
    expect(Object.keys(hidden.cards).sort()).toEqual([...linked].sort());
    expect(hidden.lanes.reduce((n, l) => n + l.hidden, 0)).toBe(data.plans.length - linked.size);
    expect(computeFlow(data.plans, data.parts, edges, { showUnlinked: false, keep: loose.slug }).cards[loose.slug]).toBeDefined();
    expect(Object.keys(computeFlow(data.plans, data.parts, edges, { showUnlinked: true }).cards)).toHaveLength(data.plans.length);
  });

  it("keeps every card in the lane of its part, lanes stacked without gaps", () => {
    const flow = computeFlow(data.plans, data.parts, edges, { showUnlinked: true });
    const lanes = new Map(flow.lanes.map((l) => [l.id, l]));
    for (const c of Object.values(flow.cards)) {
      const lane = lanes.get(c.lane)!;
      expect(data.plans.find((p) => p.slug === c.slug)!.part).toBe(c.lane);
      expect(c.y).toBeGreaterThanOrEqual(lane.y);
      expect(c.y + c.h).toBeLessThanOrEqual(lane.y + lane.h);
    }
    flow.lanes.forEach((l, i) => i && expect(l.y).toBe(flow.lanes[i - 1].y + flow.lanes[i - 1].h));
    expect(flow.lanes[0].id).toBe("governance");
    expect(flow.lanes.at(-1)!.id).toBe("foundation");
  });

  it("stacks the four audit stages in the reverse of the order of the other views", () => {
    const stages = data.parts.filter((p) => p.kind === "pillar").sort((a, b) => a.position - b.position).map((p) => p.id);
    expect(stages).toHaveLength(4);
    const flow = computeFlow(data.plans, data.parts, edges, { showUnlinked: true });
    expect(flow.lanes.map((l) => l.id)).toEqual(["governance", ...[...stages].reverse(), "foundation"]);
  });

  it("points every arrow right, except a loop that closes a cycle", () => {
    const flow = computeFlow(data.plans, data.parts, edges, { showUnlinked: false });
    expect(flow.arrows).toHaveLength(edges.length);
    for (const a of flow.arrows.filter((x) => !x.back)) expect(flow.cards[a.to].x, `${a.from} -> ${a.to}`).toBeGreaterThan(flow.cards[a.from].x);
  });

  it("orders the cards so that arrows cross no more than before", () => {
    const { before, after } = computeFlow(data.plans, data.parts, edges, { showUnlinked: false }).crossings;
    expect(after).toBeLessThanOrEqual(before);
  });
});
