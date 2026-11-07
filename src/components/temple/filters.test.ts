import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { ATTENTION, NO_FILTERS, isActive, makeMatcher, ownedBy, parseFilters, serializeFilters, toggle, type Filters, type Submitter } from "./filters";
import type { ProgressData } from "./types";

const data = JSON.parse(readFileSync(resolve(process.cwd(), "public/data/progress.json"), "utf8")) as ProgressData;
const submitters = JSON.parse(readFileSync(resolve(process.cwd(), "public/data/submitters.json"), "utf8")) as Submitter[];
const count = (f: Filters, owned: Set<string> | null = null) => data.plans.filter(makeMatcher(f, owned)).length;

describe("filters", () => {
  it("matches every plan when nothing is selected", () => {
    expect(isActive(NO_FILTERS)).toBe(false);
    expect(count(NO_FILTERS)).toBe(data.plans.length);
  });

  it("filters on type, matching the generator's kinds", () => {
    let total = 0;
    for (const kind of data.kinds) {
      const n = count({ ...NO_FILTERS, kinds: [kind] });
      expect(n).toBe(data.plans.filter((p) => p.kind === kind).length);
      total += n;
    }
    expect(total).toBe(data.plans.length);
    expect(count({ ...NO_FILTERS, kinds: ["agent"] })).toBeGreaterThan(0);
  });

  it("filters on stage and the stage counts add up to all plans", () => {
    let total = 0;
    for (const id of [0, 1, 2, 3, 4, 5]) {
      const n = count({ ...NO_FILTERS, stages: [id] });
      expect(n).toBe(data.plans.filter((p) => p.stage === id).length);
      total += n;
    }
    expect(total).toBe(data.plans.length);
  });

  it("filters on one alert, and on 'needs attention' (an error or a warning)", () => {
    for (const a of data.alert_catalog) {
      expect(count({ ...NO_FILTERS, alerts: [a.id] }), a.id).toBe(data.plans.filter((p) => p.alerts.some((x) => x.id === a.id)).length);
    }
    const attention = data.plans.filter((p) => p.alerts.some((a) => a.severity !== "info")).length;
    expect(attention).toBeGreaterThan(0);
    expect(count({ ...NO_FILTERS, alerts: [ATTENTION] })).toBe(attention);
    // 'Status still Draft' is an alert, but only a note: it must not make every plan "need attention"
    expect(attention).toBeLessThan(data.plans.length / 2);
  });

  it("combines dimensions with AND and values inside a dimension with OR", () => {
    const agents = count({ ...NO_FILTERS, kinds: ["agent"] });
    const building = count({ ...NO_FILTERS, stages: [2] });
    const both = count({ ...NO_FILTERS, kinds: ["agent"], stages: [2] });
    expect(both).toBeLessThanOrEqual(Math.min(agents, building));
    expect(count({ ...NO_FILTERS, stages: [2, 3] })).toBe(count({ ...NO_FILTERS, stages: [2] }) + count({ ...NO_FILTERS, stages: [3] }));
    expect(count({ ...NO_FILTERS, kinds: ["agent", "workflow"] })).toBe(count({ ...NO_FILTERS, kinds: ["agent"] }) + count({ ...NO_FILTERS, kinds: ["workflow"] }));
  });

  it("filters on sector", () => {
    const banking = data.plans.filter((p) => p.sectors.includes("Banking")).length;
    expect(banking).toBeGreaterThan(0);
    expect(count({ ...NO_FILTERS, sectors: ["Banking"] })).toBe(banking);
  });

  it("round-trips through the link query string", () => {
    const f: Filters = { stages: [2, 3], kinds: ["agent", "workflow"], alerts: [ATTENTION, "duplicate-repos"], sectors: ["Payments/Fintech"], owner: "Rohan Sobha" };
    expect(parseFilters(serializeFilters(f))).toEqual(f);
    expect(parseFilters("")).toEqual(NO_FILTERS);
    expect(parseFilters("stage=99,x&type=bogus&alert=NOT%20OK!").stages).toEqual([]);
    expect(parseFilters("type=bogus").kinds).toEqual([]);
    expect(parseFilters("alert=NOT%20OK!").alerts).toEqual([]);
    // old links with ?repo=... are simply ignored
    expect(parseFilters("repo=missing")).toEqual(NO_FILTERS);
  });

  it("toggles values", () => {
    expect(toggle([1, 2], 3)).toEqual([1, 2, 3]);
    expect(toggle([1, 2], 2)).toEqual([1]);
  });
});

describe("personal view", () => {
  it("collects the plans listed under a person's name", () => {
    const person = submitters.find((s) => s.plans.length > 1 && !s.name.includes("(") && s.name.includes(" "))!;
    const owned = ownedBy(person.name, data.plans, submitters);
    for (const slug of person.plans) expect(owned.has(slug), slug).toBe(true);
  });

  it("only shows that person's plans, and none for an unknown person", () => {
    const person = submitters.find((s) => s.plans.length > 0)!;
    const owned = ownedBy(person.name, data.plans, submitters);
    expect(count({ ...NO_FILTERS, owner: person.name }, owned)).toBe(owned.size);
    expect(count({ ...NO_FILTERS, owner: "Nobody Atall" }, ownedBy("Nobody Atall", data.plans, submitters))).toBe(0);
    expect(count({ ...NO_FILTERS, owner: person.name }, null)).toBe(0);
  });

  it("requires every part of the name for claims", () => {
    const plans = [{ slug: "a", claimed_by: "Frank Lubbers" }, { slug: "b", claimed_by: "Frank Heldens" }] as never;
    expect([...ownedBy("Frank Lubbers", plans, [])]).toEqual(["a"]);
  });
});
