import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { BUNDLED_RELATIONS, cleanRelations, relationsOf } from "./relations";
import type { ProgressData, Relation } from "./types";

const data = JSON.parse(readFileSync(resolve(process.cwd(), "public/data/progress.json"), "utf8")) as ProgressData;
const slugs = new Set(data.plans.map((p) => p.slug));
const rel = (from: string, to: string, extra: Partial<Relation> = {}): Relation => ({ from, to, what: "x", status: "suggested", sources: [{ file: "f.md", quote: "q" }], ...extra });

describe("relations.json", () => {
  it("only names plans that exist", () => {
    for (const r of BUNDLED_RELATIONS.relations) {
      expect(slugs.has(r.from), r.from).toBe(true);
      expect(slugs.has(r.to), r.to).toBe(true);
    }
  });

  it("says for every relation where it was read, and whether an owner confirmed it", () => {
    expect(BUNDLED_RELATIONS.schema_version).toBe(1);
    for (const r of BUNDLED_RELATIONS.relations) {
      expect(["suggested", "confirmed"]).toContain(r.status);
      expect(r.sources.length, `${r.from} -> ${r.to}`).toBeGreaterThan(0);
      for (const s of r.sources) {
        expect(s.file).toMatch(/^plans\/.+\.md$/);
        expect(s.quote.length).toBeGreaterThan(10);
      }
      if (r.status === "confirmed") expect(r.confirmed_by, `${r.from} -> ${r.to}`).toBeTruthy();
    }
  });

  it("has no pair twice and no plan feeding itself", () => {
    const { edges, warnings } = cleanRelations(BUNDLED_RELATIONS.relations, data.plans);
    expect(warnings).toEqual([]);
    expect(edges).toHaveLength(BUNDLED_RELATIONS.relations.length);
  });
});

describe("cleaning relations", () => {
  const plans = [{ slug: "a" }, { slug: "b" }, { slug: "c" }];

  it("drops unknown plans and self-loops, with a warning for each", () => {
    const { edges, warnings } = cleanRelations([rel("a", "b"), rel("a", "zz"), rel("c", "c")], plans);
    expect(edges.map((e) => `${e.from}>${e.to}`)).toEqual(["a>b"]);
    expect(warnings).toHaveLength(2);
    expect(warnings[0]).toContain("zz");
  });

  it("merges the same pair into one arrow: both labels, all sources, confirmed if either is", () => {
    const { edges } = cleanRelations([rel("a", "b", { what: "RCM" }), rel("a", "b", { what: "evidence", status: "confirmed", confirmed_by: "x" })], plans);
    expect(edges).toHaveLength(1);
    expect(edges[0].what).toBe("RCM, evidence");
    expect(edges[0].sources).toHaveLength(2);
    expect(edges[0].status).toBe("confirmed");
  });

  it("splits a plan's relations into what it gets and what it gives", () => {
    const { edges } = cleanRelations([rel("a", "b"), rel("b", "c"), rel("c", "a")], plans);
    const { inputs, outputs } = relationsOf("b", edges);
    expect(inputs.map((e) => e.from)).toEqual(["a"]);
    expect(outputs.map((e) => e.to)).toEqual(["c"]);
  });
});
