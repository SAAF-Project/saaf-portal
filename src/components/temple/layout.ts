import { byMaturity } from "./stages";
import type { PartRecord, PlanRecord, ProgressData } from "./types";

type V3 = [number, number, number];
export type Poly = [number, number][];

export interface Box {
  center: V3;
  size: V3;
}

/** The geometry of one plan cell: a box, or a flat polygon (in x,y around its centre) extruded in z. */
export type CellGeom = { type: "box"; size: V3 } | { type: "poly"; points: Poly; depth: number };

/**
 * One plan as a piece of its part's shape. All cells of a part have the same surface area and tile the
 * part exactly (no gaps, no empty slots), so "share of the surface" and "share of the plans" are the same number.
 */
export interface Cell {
  slug: string;
  partId: string;
  pos: V3; // centre
  size: V3; // bounding box
  geom: CellGeom;
  topExposed: boolean; // nothing sits on top of this piece, so its top face is visible (and can carry a tag)
}

export interface RoofBody {
  type: "roof";
  baseY: number;
  width: number;
  beamH: number; // the beam under the pediment is part of the roof
  triH: number;
  depth: number;
  nBeam: number; // plans in the beam
  nTri: number; // plans in the pediment
  n: number; // total plans
}

/** A part as it looks collapsed (first screen): a solid shape, banded by stage. */
export type Body = { type: "box"; center: V3; size: V3; axis: "x" | "y" } | RoofBody;

export interface Layout {
  cells: Record<string, Cell>; // plans inside the temple
  annexCells: Record<string, Cell>; // plans inside the repo annex (the same plans can appear in both)
  bodies: Record<string, Body>; // collapsed shape per part
  partBox: Record<string, Box>; // bounding box per part: camera targets and label anchors
  pillarX: Record<string, number>;
  annexX: number;
  pillarBaseY: number;
  pillarTopY: number;
  roofBaseY: number;
  topY: number; // apex of the pediment
  frontZ: number; // front edge of the foundation
  minX: number;
  maxX: number;
}

// Proportions. The three layers (foundation, pillars, roof) are separated by a visible gap.
export const TEMPLE_W = 22.8;
export const FOUND_H = 0.6;
export const FOUND_D = 7.6;
export const LAYER_GAP = 0.8;
export const PILLAR_W = 3.8;
export const PILLAR_D = 3;
export const PILLAR_H = 6.2;
export const PILLAR_SPACING = 5.9;
export const ROOF_W = TEMPLE_W + 0.4;
export const ROOF_TRI_H = 3.6;
export const ROOF_D = 3.6;
export const ANNEX_W = 6.2;
export const ANNEX_H = 4.6;
export const ANNEX_D = 4.2;
export const ANNEX_GAP = 3;

function plansOf(data: ProgressData, part: PartRecord): PlanRecord[] {
  const bySlug = new Map(data.plans.map((p) => [p.slug, p]));
  return part.plans.map((s) => bySlug.get(s)).filter((p): p is PlanRecord => !!p).sort(byMaturity);
}

/** Split n cells over `rows` rows as evenly as possible; the first (least mature) rows get the extra cells. */
export function splitCounts(n: number, rows: number): number[] {
  const base = Math.floor(n / rows);
  const extra = n % rows;
  return Array.from({ length: rows }, (_, i) => base + (i < extra ? 1 : 0));
}

/** Rows so that cells come out roughly square for n plans in a width x height rectangle. */
export function rowsFor(n: number, width: number, height: number): number {
  return Math.min(n, Math.max(1, Math.round(Math.sqrt((n * height) / width))));
}

/** Rows of a triangle (apex up) with piece counts proportional to row area (1, 3, 5, ...), summing to n. */
export function triangleCounts(n: number): number[] {
  const rows = Math.max(1, Math.round(Math.sqrt(n)));
  const weights = Array.from({ length: rows }, (_, k) => 2 * k + 1);
  const total = weights.reduce((a, b) => a + b, 0);
  const counts = weights.map((w) => Math.max(1, Math.round((n * w) / total)));
  let diff = n - counts.reduce((a, b) => a + b, 0);
  for (let i = rows - 1; diff !== 0; i = i === 0 ? rows - 1 : i - 1) {
    if (diff > 0) {
      counts[i] += 1;
      diff -= 1;
    } else if (counts[i] > 1) {
      counts[i] -= 1;
      diff += 1;
    }
  }
  return counts;
}

export interface Rect {
  u0: number;
  u1: number;
  v0: number;
  v1: number;
}

/**
 * Tile a width x height rectangle with n cells of exactly equal area, in rows along v (row heights follow
 * the number of cells in the row). Cells are ordered row by row from v = 0.
 */
export function tileRect(n: number, width: number, height: number): Rect[] {
  if (n <= 0) return [];
  const counts = splitCounts(n, rowsFor(n, width, height));
  const out: Rect[] = [];
  let v = 0;
  for (const c of counts) {
    const h = (height * c) / n;
    for (let k = 0; k < c; k++) out.push({ u0: (width * k) / c, u1: (width * (k + 1)) / c, v0: v, v1: v + h });
    v += h;
  }
  return out;
}

function boxCell(slug: string, partId: string, pos: V3, size: V3, topExposed: boolean): Cell {
  return { slug, partId, pos, size, geom: { type: "box", size }, topExposed };
}

/** The roof is a beam plus a pediment. Plans are cut into equal-area pieces: the beam first (least mature), then pediment rows up to the apex (most mature). */
function roofCells(plans: PlanRecord[], partId: string, out: Record<string, Cell>, baseY: number): RoofBody {
  const n = plans.length;
  const nBeam = n < 2 ? 0 : Math.min(n - 1, Math.max(1, Math.round(n * 0.35)));
  const nTri = n - nBeam;
  // beam height such that a beam piece has the same area as a pediment piece
  const beamH = nBeam > 0 ? (nBeam * ROOF_TRI_H) / (2 * nTri) : 0;
  const body: RoofBody = { type: "roof", baseY, width: ROOF_W, beamH, triH: ROOF_TRI_H, depth: ROOF_D, nBeam, nTri, n };
  let i = 0;

  for (let c = 0; c < nBeam; c++) {
    const w = ROOF_W / nBeam;
    const size: V3 = [w, beamH, ROOF_D];
    out[plans[i].slug] = boxCell(plans[i].slug, partId, [-ROOF_W / 2 + w * (c + 0.5), baseY + beamH / 2, 0], size, false); // the pediment sits on the beam
    i++;
  }

  if (nTri > 0) {
    const counts = triangleCounts(nTri);
    const cumulative: number[] = [];
    counts.reduce((acc, c, k) => (cumulative[k] = acc + c), 0);
    const apexY = baseY + beamH + ROOF_TRI_H;
    // rows from the base up, so the most mature plans end up at the apex
    for (let k = counts.length - 1; k >= 0; k--) {
      const d0 = ROOF_TRI_H * Math.sqrt((k === 0 ? 0 : cumulative[k - 1]) / nTri); // distance from the apex: top edge
      const d1 = ROOF_TRI_H * Math.sqrt(cumulative[k] / nTri); // bottom edge
      const w0 = (ROOF_W * d0) / ROOF_TRI_H;
      const w1 = (ROOF_W * d1) / ROOF_TRI_H;
      const yTop = apexY - d0;
      const yBottom = apexY - d1;
      const m = counts[k];
      for (let c = 0; c < m; c++) {
        const raw: Poly = [
          [-w1 / 2 + (w1 * c) / m, yBottom],
          [-w1 / 2 + (w1 * (c + 1)) / m, yBottom],
          [-w0 / 2 + (w0 * (c + 1)) / m, yTop],
          [-w0 / 2 + (w0 * c) / m, yTop],
        ];
        const pts = raw.filter((p, j) => j === 0 || p[0] !== raw[j - 1][0] || p[1] !== raw[j - 1][1]); // apex piece is a triangle
        const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
        const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
        const xs = pts.map((p) => p[0]);
        const ys = pts.map((p) => p[1]);
        const slug = plans[i++].slug;
        out[slug] = {
          slug,
          partId,
          pos: [cx, cy, 0],
          size: [Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), ROOF_D],
          geom: { type: "poly", points: pts.map(([x, y]) => [x - cx, y - cy] as [number, number]), depth: ROOF_D },
          topExposed: false,
        };
      }
    }
  }
  return body;
}

/** Height (above the roof base) at which a fraction f of the roof's surface area lies below. */
function roofHeightAt(body: RoofBody, f: number): number {
  const c = f * body.n;
  if (body.nBeam > 0 && c <= body.nBeam) return (body.beamH * c) / body.nBeam;
  const s = Math.sqrt(Math.max(0, (body.n - c) / body.nTri));
  return body.beamH + body.triH * (1 - s);
}

/** Outline (x, y above the roof base) of the slice of the roof between area fractions f0 and f1. */
export function roofBandPolygon(body: RoofBody, f0: number, f1: number): Poly {
  const widthAt = (y: number) => (y <= body.beamH + 1e-9 ? body.width : body.width * (1 - (y - body.beamH) / body.triH));
  const y0 = roofHeightAt(body, f0);
  const y1 = roofHeightAt(body, f1);
  const pts: Poly = [[-widthAt(y0) / 2, y0]];
  const crossesCorner = body.beamH > 0 && y0 < body.beamH - 1e-9 && y1 > body.beamH + 1e-9;
  if (crossesCorner) pts.push([-body.width / 2, body.beamH]);
  pts.push([-widthAt(y1) / 2, y1], [widthAt(y1) / 2, y1]);
  if (crossesCorner) pts.push([body.width / 2, body.beamH]);
  pts.push([widthAt(y0) / 2, y0]);
  return pts;
}

export function polyArea(p: Poly): number {
  let a = 0;
  p.forEach(([x, y], i) => {
    const [x2, y2] = p[(i + 1) % p.length];
    a += x * y2 - x2 * y;
  });
  return Math.abs(a) / 2;
}

export function computeLayout(data: ProgressData): Layout {
  const cells: Record<string, Cell> = {};
  const annexCells: Record<string, Cell> = {};
  const bodies: Record<string, Body> = {};
  const partBox: Record<string, Box> = {};
  const pillarX: Record<string, number> = {};
  const parts = Object.fromEntries(data.parts.map((p) => [p.id, p]));

  // Foundation: a slab, tiled in columns along x, red at the left growing to green at the right.
  const foundation = parts["foundation"];
  bodies["foundation"] = { type: "box", center: [0, FOUND_H / 2, 0], size: [TEMPLE_W, FOUND_H, FOUND_D], axis: "x" };
  partBox["foundation"] = { center: [0, FOUND_H / 2, 0], size: [TEMPLE_W, FOUND_H, FOUND_D] };
  if (foundation) {
    const plans = plansOf(data, foundation);
    tileRect(plans.length, FOUND_D, TEMPLE_W).forEach((r, i) => {
      const size: V3 = [r.v1 - r.v0, FOUND_H, r.u1 - r.u0];
      const pos: V3 = [-TEMPLE_W / 2 + (r.v0 + r.v1) / 2, FOUND_H / 2, -FOUND_D / 2 + (r.u0 + r.u1) / 2];
      cells[plans[i].slug] = boxCell(plans[i].slug, "foundation", pos, size, true);
    });
  }

  // Pillars: one per audit stage, lifted off the foundation. Plans stack up, red at the bottom growing to green at the top.
  const pillarBaseY = FOUND_H + LAYER_GAP;
  const pillarTopY = pillarBaseY + PILLAR_H;
  const pillars = data.parts.filter((p) => p.kind === "pillar").sort((a, b) => a.position - b.position);
  pillars.forEach((part, k) => {
    const px = (k - (pillars.length - 1) / 2) * PILLAR_SPACING;
    pillarX[part.id] = px;
    const center: V3 = [px, pillarBaseY + PILLAR_H / 2, 0];
    bodies[part.id] = { type: "box", center, size: [PILLAR_W, PILLAR_H, PILLAR_D], axis: "y" };
    partBox[part.id] = { center, size: [PILLAR_W, PILLAR_H, PILLAR_D] };
    const plans = plansOf(data, part);
    tileRect(plans.length, PILLAR_W, PILLAR_H).forEach((r, i) => {
      const size: V3 = [r.u1 - r.u0, r.v1 - r.v0, PILLAR_D];
      const pos: V3 = [px - PILLAR_W / 2 + (r.u0 + r.u1) / 2, pillarBaseY + (r.v0 + r.v1) / 2, 0];
      cells[plans[i].slug] = boxCell(plans[i].slug, part.id, pos, size, r.v1 >= PILLAR_H - 1e-9);
    });
  });

  // Roof: beam and pediment as one shape, lifted off the pillars.
  const roofBaseY = pillarTopY + LAYER_GAP;
  const roof = roofCells(parts["governance"] ? plansOf(data, parts["governance"]) : [], "governance", cells, roofBaseY);
  bodies["governance"] = roof;
  const roofH = roof.beamH + roof.triH;
  partBox["governance"] = { center: [0, roofBaseY + roofH / 2, 0], size: [ROOF_W, roofH, ROOF_D] };
  const topY = roofBaseY + roofH;

  // Repo annex: the seventh block, beside the temple, tiled like a pillar.
  const annexX = ROOF_W / 2 + ANNEX_GAP + ANNEX_W / 2;
  const annex = parts["annex"];
  const annexCenter: V3 = [annexX, ANNEX_H / 2, 0];
  bodies["annex"] = { type: "box", center: annexCenter, size: [ANNEX_W, ANNEX_H, ANNEX_D], axis: "y" };
  partBox["annex"] = { center: annexCenter, size: [ANNEX_W, ANNEX_H, ANNEX_D] };
  if (annex) {
    const plans = plansOf(data, annex);
    tileRect(plans.length, ANNEX_W, ANNEX_H).forEach((r, i) => {
      const size: V3 = [r.u1 - r.u0, r.v1 - r.v0, ANNEX_D];
      const pos: V3 = [annexX - ANNEX_W / 2 + (r.u0 + r.u1) / 2, (r.v0 + r.v1) / 2, 0];
      annexCells[plans[i].slug] = boxCell(plans[i].slug, "annex", pos, size, r.v1 >= ANNEX_H - 1e-9);
    });
  }

  // Quarry: plans with neither a workstream track nor a proposal wait beside the temple as loose blocks.
  const quarry = parts["quarry"];
  if (quarry && quarry.plans.length) {
    plansOf(data, quarry).forEach((plan, i) => {
      const pos: V3 = [-TEMPLE_W / 2 - 3 - (i % 3) * 1.5, 0.4, 3 + Math.floor(i / 3) * 1.5];
      cells[plan.slug] = boxCell(plan.slug, "quarry", pos, [1.2, 0.8, 1.2], true);
    });
    partBox["quarry"] = { center: [-TEMPLE_W / 2 - 4, 0.5, 4], size: [5, 1, 4] };
  }

  return {
    cells,
    annexCells,
    bodies,
    partBox,
    pillarX,
    annexX,
    pillarBaseY,
    pillarTopY,
    roofBaseY,
    topY,
    frontZ: FOUND_D / 2,
    minX: -(ROOF_W / 2 + 0.3),
    maxX: annexX + ANNEX_W / 2 + 0.3,
  };
}
