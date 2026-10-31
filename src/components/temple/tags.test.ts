import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { withAnnexPart } from "./derive";
import { computeLayout, polyArea, type Cell, type Poly } from "./layout";
import { cornerTriangle, faceMarks, facesOf, fitFont, tagCorners, tagSize } from "./tags";
import type { ProgressData } from "./types";

const data = withAnnexPart(JSON.parse(readFileSync(resolve(process.cwd(), "public/data/progress.json"), "utf8")) as ProgressData);
const layout = computeLayout(data);
const square: Poly = [[-1, -1], [1, -1], [1, 1], [-1, 1]];

describe("corner tags", () => {
  it("cuts a triangle off a corner along the two edges", () => {
    const t = cornerTriangle(square, 3, 0.5); // top-left vertex (-1, 1)
    expect(t[0]).toEqual([-1, 1]);
    expect(polyArea(t)).toBeCloseTo(0.125, 9);
    t.forEach(([x, y]) => {
      expect(x).toBeGreaterThanOrEqual(-1 - 1e-9);
      expect(y).toBeLessThanOrEqual(1 + 1e-9);
    });
  });

  it("never grows beyond half an edge", () => {
    const t = cornerTriangle(square, 0, 10);
    expect(polyArea(t)).toBeCloseTo(0.5 * 1 * 1, 9);
  });

  it("puts the left and right tags on the viewer's near side", () => {
    expect(tagCorners(square, "top")).toEqual({ left: 3, right: 2 }); // top-left, top-right
    expect(tagCorners(square, "bottom")).toEqual({ left: 0, right: 1 }); // bottom-left, bottom-right
  });

  it("keeps tags readable", () => {
    expect(tagSize(rect(0.1))).toBeGreaterThanOrEqual(0.3);
    expect(tagSize(rect(10))).toBeLessThanOrEqual(1.2);
  });
});

function rect(s: number): Poly {
  return [[-s, -s], [s, -s], [s, s], [-s, s]];
}

describe("faces that carry tags", () => {
  const cells = Object.values(layout.cells);

  it("box pieces get a front and back face, and a top face only when nothing sits on them", () => {
    const pillar = cells.filter((c) => c.partId === "planning");
    const highest = Math.max(...pillar.map((c) => c.pos[1]));
    for (const c of pillar) {
      const names = facesOf(c).map((f) => f.name).sort();
      expect(names, c.slug).toEqual(c.pos[1] === highest ? ["back", "front", "top"] : ["back", "front"]);
      expect(c.topExposed, c.slug).toBe(c.pos[1] === highest);
    }
  });

  it("never tags the covered top of a roof piece", () => {
    for (const c of cells.filter((x) => x.partId === "governance")) {
      if (c.geom.type === "box") expect(facesOf(c).map((f) => f.name), c.slug).not.toContain("top");
    }
  });

  it("every piece has at least a front and a back face to tag, whatever its shape", () => {
    for (const c of [...cells, ...Object.values(layout.annexCells)]) {
      const names = facesOf(c).map((f) => f.name);
      expect(names, c.slug).toContain("front");
      expect(names, c.slug).toContain("back");
    }
  });

  it("gives polygon pieces a face on their most upward-facing edge", () => {
    const poly = cells.filter((c: Cell) => c.geom.type === "poly");
    expect(poly.length).toBeGreaterThan(0);
    expect(poly.some((c) => facesOf(c).some((f) => f.name === "top"))).toBe(true);
  });

  it("points every face frame out of the piece, with a right-handed basis", () => {
    for (const c of cells) {
      for (const f of facesOf(c)) {
        const [a, b, n] = [f.ex, f.ey, f.ez];
        const cross = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
        // a proper rotation: ex x ey = ez exactly (a mirrored frame would turn the tag the wrong way)
        expect(cross[0], `${c.slug} ${f.name}`).toBeCloseTo(n[0], 6);
        expect(cross[1], `${c.slug} ${f.name}`).toBeCloseTo(n[1], 6);
        expect(cross[2], `${c.slug} ${f.name}`).toBeCloseTo(n[2], 6);
        // the face sits on the outside of the piece
        const p = f.position;
        expect(p[0] * n[0] + p[1] * n[1] + p[2] * n[2], `${c.slug} ${f.name}`).toBeGreaterThan(0);
      }
    }
  });
});

describe("plan names on the faces", () => {
  const inside = (r: { cx: number; cy: number; w: number; h: number }, p: Poly) => {
    const xs = p.map((q) => q[0]), ys = p.map((q) => q[1]);
    return r.cx - r.w / 2 >= Math.min(...xs) - 1e-9 && r.cx + r.w / 2 <= Math.max(...xs) + 1e-9 && r.cy - r.h / 2 >= Math.min(...ys) - 1e-9 && r.cy + r.h / 2 <= Math.max(...ys) + 1e-9;
  };
  const apart = (a: { x0: number; y0: number; x1: number; y1: number }, b: { x0: number; y0: number; x1: number; y1: number }) =>
    a.x1 <= b.x0 + 1e-9 || b.x1 <= a.x0 + 1e-9 || a.y1 <= b.y0 + 1e-9 || b.y1 <= a.y0 + 1e-9;

  it("fits fewer letters larger, and wraps long names rather than shrinking them to nothing", () => {
    expect(fitFont(10, 2, 1)).toBeGreaterThan(fitFont(40, 2, 1));
    expect(fitFont(40, 1, 1)).toBeGreaterThan(fitFont(40, 1, 0.3)); // a taller box lets it wrap
  });

  it("writes the name inside the face, with the symbol shrunk to an icon that does not overlap it", () => {
    const marks = faceMarks({ points: rect(0.6), corner: "top" }, { glyph: true, tags: { left: false, right: false }, chars: 24 });
    expect(marks.name).not.toBeNull();
    expect(inside(marks.name!, rect(0.6))).toBe(true);
    const g = marks.glyph!;
    const n = marks.name!;
    expect(g.size).toBeLessThan(0.5);
    expect(apart({ x0: g.x - g.size / 2, y0: g.y - g.size / 2, x1: g.x + g.size / 2, y1: g.y + g.size / 2 }, { x0: n.cx - n.w / 2, y0: n.cy - n.h / 2, x1: n.cx + n.w / 2, y1: n.cy + n.h / 2 })).toBe(true);
  });

  it("keeps the name clear of the corner tags the plan carries", () => {
    const face = { points: rect(0.6), corner: "top" as const };
    const marks = faceMarks(face, { glyph: true, tags: { left: true, right: true }, chars: 24 });
    const n = marks.name!;
    const { left, right } = tagCorners(face.points, face.corner);
    for (const v of [left, right]) {
      for (const [x, y] of cornerTriangle(face.points, v, tagSize(face.points))) {
        // no tag corner lies strictly inside the name's rectangle
        expect(x > n.cx - n.w / 2 + 1e-9 && x < n.cx + n.w / 2 - 1e-9 && y > n.cy - n.h / 2 + 1e-9 && y < n.cy + n.h / 2 - 1e-9).toBe(false);
      }
    }
  });

  it("falls back to the large centred symbol when no readable name fits", () => {
    const marks = faceMarks({ points: rect(0.4), corner: "top" }, { glyph: true, tags: { left: true, right: true }, chars: 400 });
    expect(marks.name).toBeNull();
    expect(marks.glyph).toEqual({ x: 0, y: 0, size: expect.any(Number) });
  });

  it("names every opened piece of the real temple", () => {
    const named = [...Object.values(layout.cells), ...Object.values(layout.annexCells)].filter((c) => {
      const plan = data.plans.find((p) => p.slug === c.slug);
      const chars = (plan?.title || c.slug).length;
      return facesOf(c).some((f) => f.name === "front" && faceMarks(f, { glyph: true, tags: { left: true, right: true }, chars }).name);
    });
    expect(named.length).toBe(Object.keys(layout.cells).length + Object.keys(layout.annexCells).length);
  });
});
