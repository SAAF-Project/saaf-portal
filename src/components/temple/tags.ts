import type { Cell, Poly } from "./layout";

type V3 = [number, number, number];

/**
 * A face of a plan piece that carries the repo tags. `points` is its outline in the face's own plane;
 * (ex, ey, ez) is the frame of that plane in the piece's space (ez points out of the piece).
 */
export interface Face {
  name: "front" | "back" | "top";
  points: Poly;
  position: V3;
  ex: V3;
  ey: V3;
  ez: V3;
  corner: "top" | "bottom"; // which corners, in the face's own plane, are nearest to the viewer's eye
}

const EPS = 0.012; // tags float just above the face

const rect = (w: number, h: number): Poly => [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]];
const bbox = (p: Poly) => {
  const xs = p.map((q) => q[0]);
  const ys = p.map((q) => q[1]);
  return { w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
};

/** Faces of a piece that get tags: front, back and top (boxes), or front, back and the most upward-facing edge (polygons). */
export function facesOf(cell: Cell): Face[] {
  const faces: Face[] = [];
  const add = (f: Face) => {
    const b = bbox(f.points);
    if (Math.min(b.w, b.h) >= 0.35) faces.push(f); // too small to carry a readable tag
  };

  if (cell.geom.type === "box") {
    const [w, h, d] = cell.geom.size;
    add({ name: "front", points: rect(w, h), position: [0, 0, d / 2 + EPS], ex: [1, 0, 0], ey: [0, 1, 0], ez: [0, 0, 1], corner: "top" });
    add({ name: "back", points: rect(w, h), position: [0, 0, -d / 2 - EPS], ex: [-1, 0, 0], ey: [0, 1, 0], ez: [0, 0, -1], corner: "top" });
    // looking at the top from the front, the near edge is local -y
    if (cell.topExposed) add({ name: "top", points: rect(w, d), position: [0, h / 2 + EPS, 0], ex: [1, 0, 0], ey: [0, 0, -1], ez: [0, 1, 0], corner: "bottom" });
    return faces;
  }

  const { points, depth } = cell.geom;
  add({ name: "front", points, position: [0, 0, depth / 2 + EPS], ex: [1, 0, 0], ey: [0, 1, 0], ez: [0, 0, 1], corner: "top" });
  add({ name: "back", points: points.map(([x, y]) => [-x, y] as [number, number]), position: [0, 0, -depth / 2 - EPS], ex: [-1, 0, 0], ey: [0, 1, 0], ez: [0, 0, -1], corner: "top" });

  // the polygon is counter-clockwise, so the outward normal of an edge (dx, dy) is (dy, -dx)
  let best: { i: number; ny: number; len: number } | null = null;
  points.forEach(([x, y], i) => {
    const [x2, y2] = points[(i + 1) % points.length];
    const dx = x2 - x, dy = y2 - y;
    const len = Math.hypot(dx, dy);
    const ny = -dx / len;
    // only slanted edges are exposed: a flat top edge always has the next row of pieces on it
    if (len > 0.5 && ny > 0.25 && ny < 0.97 && (!best || ny > best.ny + 1e-9)) best = { i, ny, len };
  });
  if (best) {
    const { i, len } = best;
    const [x, y] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    const dx = (x2 - x) / len, dy = (y2 - y) / len;
    const n: V3 = [dy, -dx, 0];
    // keep local +u pointing to the viewer's right where possible. Turning the face half a circle around its normal
    // (ex and ey both flip) keeps the frame a proper rotation; flipping ex alone would mirror it.
    const turned = dx < 0;
    add({
      name: "top",
      points: rect(len, depth),
      position: [(x + x2) / 2 + n[0] * EPS, (y + y2) / 2 + n[1] * EPS, 0],
      ex: turned ? [-dx, -dy, 0] : [dx, dy, 0],
      ey: [0, 0, turned ? -1 : 1],
      ez: n,
      corner: turned ? "bottom" : "top", // the viewer stands on the +z side
    });
  }
  return faces;
}

/** Triangle that cuts off the corner at vertex `v` of a polygon, following the two edges that meet there. */
export function cornerTriangle(points: Poly, v: number, size: number): Poly {
  const n = points.length;
  const [vx, vy] = points[v];
  const leg = (to: [number, number]): [number, number] => {
    const dx = to[0] - vx, dy = to[1] - vy;
    const len = Math.hypot(dx, dy);
    const t = Math.min(size, len * 0.5);
    return [vx + (dx / len) * t, vy + (dy / len) * t];
  };
  return [[vx, vy], leg(points[(v + 1) % n]), leg(points[(v + n - 1) % n])];
}

/** The two corners that carry tags: left and right, on the side of the face nearest to the viewer. */
export function tagCorners(points: Poly, corner: "top" | "bottom"): { left: number; right: number } {
  const up = corner === "top" ? 1 : -1;
  let left = 0, right = 0, bestLeft = -Infinity, bestRight = -Infinity;
  points.forEach(([x, y], i) => {
    if (up * y * 2 - x > bestLeft) { bestLeft = up * y * 2 - x; left = i; }
    if (up * y * 2 + x > bestRight) { bestRight = up * y * 2 + x; right = i; }
  });
  return { left, right };
}

/** Tag size for a face: half of its smaller side, within a readable range. */
export function tagSize(points: Poly): number {
  const b = bbox(points);
  return Math.min(1.2, Math.max(0.3, 0.5 * Math.min(b.w, b.h)));
}

/** Size of the kind symbol in the middle of a face; 0 when the face is too small for one. */
export function glyphSize(points: Poly): number {
  const b = bbox(points);
  const side = Math.min(b.w, b.h);
  return side < 0.6 ? 0 : Math.min(1.1, 0.42 * side);
}

/** Where a plan's name is written on a face: a rectangle in the face's own plane, and the letter height that fits it. */
export interface NameRect {
  cx: number;
  cy: number;
  w: number;
  h: number;
  font: number; // estimated letter height in world units
}

/** The marks inside a face: the kind symbol (centre and size) and the plan's name. */
export interface FaceMarks {
  glyph: { x: number; y: number; size: number } | null;
  name: NameRect | null;
}

const CHAR_W = 0.55; // average letter width of the label font, in ems
const LINE_H = 1.2; // line height, in ems (keep in step with nameTexture.ts)
const MIN_FONT = 0.07; // below this a name is unreadable from any useful distance
const ICON = 0.6; // the symbol shrinks to this share of its own size when a name is written next to it

/** Largest letter height at which `chars` letters fit a w x h box, wrapped onto up to three lines. */
export function fitFont(chars: number, w: number, h: number): number {
  let best = 0;
  for (let lines = 1; lines <= 3; lines++) best = Math.max(best, Math.min(h / (LINE_H * lines), (w * lines) / (Math.max(chars, 1) * CHAR_W)));
  return best;
}

/** Horizontal extent of a convex polygon at height y, or null when y misses it. */
function spanAt(points: Poly, y: number): [number, number] | null {
  let lo = Infinity, hi = -Infinity;
  points.forEach(([x1, y1], i) => {
    const [x2, y2] = points[(i + 1) % points.length];
    if (y1 === y2) {
      if (y1 === y) { lo = Math.min(lo, x1, x2); hi = Math.max(hi, x1, x2); }
      return;
    }
    if ((y1 - y) * (y2 - y) > 0) return;
    const x = x1 + ((y - y1) / (y2 - y1)) * (x2 - x1);
    lo = Math.min(lo, x);
    hi = Math.max(hi, x);
  });
  return lo <= hi ? [lo, hi] : null;
}

/** Do two convex polygons overlap (separating axis test)? Touching does not count. */
function overlaps(a: Poly, b: Poly): boolean {
  for (const poly of [a, b]) {
    for (let i = 0; i < poly.length; i++) {
      const [x1, y1] = poly[i];
      const [x2, y2] = poly[(i + 1) % poly.length];
      const [nx, ny] = [y2 - y1, x1 - x2];
      const proj = (p: Poly) => p.map(([x, y]) => x * nx + y * ny);
      const [pa, pb] = [proj(a), proj(b)];
      if (Math.max(...pa) <= Math.min(...pb) + 1e-9 || Math.max(...pb) <= Math.min(...pa) + 1e-9) return false;
    }
  }
  return true;
}

const box = (x0: number, y0: number, x1: number, y1: number): Poly => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];

/**
 * Lays out the marks inside a face. When the plan's name fits at a readable size it gets the largest free spot, clear of
 * the corner tags the plan actually carries, and the kind symbol shrinks to an icon above or to the left of it.
 * Otherwise the symbol stays large in the middle, as before.
 */
export function faceMarks(face: Pick<Face, "points" | "corner">, opts: { glyph: boolean; tags: { left: boolean; right: boolean }; chars: number }): FaceMarks {
  const { points } = face;
  const full = opts.glyph ? glyphSize(points) : 0;
  const fallback: FaceMarks = { glyph: full ? { x: 0, y: 0, size: full } : null, name: null };
  if (!opts.chars) return fallback;

  const b = bbox(points);
  const side = Math.min(b.w, b.h);
  const pad = 0.08 * side;
  const gap = 0.05 * side;
  const { left, right } = tagCorners(points, face.corner);
  const size = tagSize(points);
  const blocked: Poly[] = [];
  if (opts.tags.left) blocked.push(cornerTriangle(points, left, size));
  if (opts.tags.right) blocked.push(cornerTriangle(points, right, size));
  // a rectangle is inside the (convex) face when its top and bottom edges are
  const inside = (x0: number, y0: number, x1: number, y1: number) => {
    const s0 = spanAt(points, y0), s1 = spanAt(points, y1);
    return !!s0 && !!s1 && x0 >= Math.max(s0[0], s1[0]) + pad - 1e-9 && x1 <= Math.min(s0[1], s1[1]) - pad + 1e-9;
  };
  const free = (x0: number, y0: number, x1: number, y1: number) => inside(x0, y0, x1, y1) && !blocked.some((t) => overlaps(box(x0, y0, x1, y1), t));
  const icon = ICON * full;

  const ys = points.map((p) => p[1]);
  const [ymin, ymax] = [Math.min(...ys) + pad, Math.max(...ys) - pad];
  let best: FaceMarks | null = null;
  let bestFont = MIN_FONT - 1e-9;
  const consider = (x0: number, y0: number, x1: number, y1: number, glyph: FaceMarks["glyph"]) => {
    if (x1 <= x0 || !free(x0, y0, x1, y1)) return;
    if (glyph && !free(glyph.x - glyph.size / 2, glyph.y - glyph.size / 2, glyph.x + glyph.size / 2, glyph.y + glyph.size / 2)) return;
    const font = fitFont(opts.chars, x1 - x0, y1 - y0);
    if (font > bestFont + 1e-9) {
      bestFont = font;
      best = { glyph, name: { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, w: x1 - x0, h: y1 - y0, font } };
    }
  };

  const steps = 16;
  for (let i = 0; i < steps; i++) {
    for (let j = i + 1; j <= steps; j++) {
      const y0 = ymin + ((ymax - ymin) * i) / steps;
      const y1 = ymin + ((ymax - ymin) * j) / steps;
      const s0 = spanAt(points, y0), s1 = spanAt(points, y1);
      if (!s0 || !s1) continue;
      const lo = Math.max(s0[0], s1[0]) + pad, hi = Math.min(s0[1], s1[1]) - pad;
      // the widest stretch of this strip, and the same pulled in past the corner tags
      for (const cut of [0, Math.min(size, (hi - lo) / 2)]) {
        const [x0, x1] = [lo + cut, hi - cut];
        if (!icon) {
          consider(x0, y0, x1, y1, null);
          continue;
        }
        // icon above the name, or to its left
        consider(x0, y0, x1, y1, { x: (x0 + x1) / 2, y: y1 + gap + icon / 2, size: icon });
        if (y1 - y0 >= icon) consider(x0 + icon + gap, y0, x1, y1, { x: x0 + icon / 2, y: (y0 + y1) / 2, size: icon });
      }
    }
  }
  return best ?? fallback;
}
