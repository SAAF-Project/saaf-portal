import { describe, expect, it } from "vitest";
import { backLinks, buildGraph, chainOf, columns, linkKey, unlinked } from "./graph";
import { BUNDLED_RELATIONS } from "../relations";

const uc = (n: number) => BUNDLED_RELATIONS.relations.map((r) => [r.from, r.to]).flat().find((s) => s.includes(`-uc${n}-`) && s.startsWith("frank-van-dissel"))!;

describe("dependency graph", () => {
  it("puts the UC1 to UC9 planning pipeline in strictly increasing columns", () => {
    const rel = BUNDLED_RELATIONS.relations;
    const g = buildGraph(rel.flatMap((r) => [r.from, r.to]), rel);
    const col = columns(g, backLinks(g));
    const chain = [1, 3, 4, 7, 8, 9].map((n) => col.get(uc(n))!);
    for (let i = 1; i < chain.length; i++) expect(chain[i]).toBeGreaterThan(chain[i - 1]);
  });

  it("makes every arrow point right once the links that close a cycle are turned around", () => {
    const links = [
      { from: "a", to: "b" },
      { from: "b", to: "c" },
      { from: "c", to: "a" }, // closes the cycle
      { from: "c", to: "d" },
    ];
    const g = buildGraph(["a", "b", "c", "d"], links);
    const back = backLinks(g);
    expect([...back]).toEqual([linkKey({ from: "c", to: "a" })]);
    const col = columns(g, back);
    for (const l of links) {
      if (back.has(linkKey(l))) expect(col.get(l.from)!).toBeGreaterThan(col.get(l.to)!);
      else expect(col.get(l.to)!).toBeGreaterThan(col.get(l.from)!);
    }
  });

  it("breaks cycles the same way whatever order the links come in", () => {
    const links = [
      { from: "x", to: "y" },
      { from: "y", to: "z" },
      { from: "z", to: "x" },
    ];
    const a = backLinks(buildGraph(["x", "y", "z"], links));
    const b = backLinks(buildGraph(["z", "y", "x"], [...links].reverse()));
    expect([...a]).toEqual([...b]);
  });

  it("lights up the whole chain of a plan, but not its siblings", () => {
    // a and c both feed b; b feeds d; e feeds a
    const g = buildGraph(["a", "b", "c", "d", "e"], [
      { from: "a", to: "b" },
      { from: "c", to: "b" },
      { from: "b", to: "d" },
      { from: "e", to: "a" },
    ]);
    expect([...chainOf("a", g)].sort()).toEqual(["a", "b", "d", "e"]);
    expect([...chainOf("b", g)].sort()).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("lists plans that take part in no relation", () => {
    expect(unlinked(["a", "b", "c"], [{ from: "a", to: "b" }])).toEqual(["c"]);
  });
});
