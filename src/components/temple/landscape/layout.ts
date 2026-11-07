import { hash, hashString } from "../sketch";
import { byMaturity } from "../stages";
import type { PartRecord, PlanRecord, ProgressData } from "../types";

/**
 * Where everything sits in the archipelago. Pure and deterministic: the same data always gives the same drawing.
 *
 * - Governance is the island at the back, the four audit stages are the islands in the middle (left to right), the
 *   shared infrastructure is the island in front, the Repo Annex is a small island to the right.
 * - Every plan is one object on a slot of a hexagonal grid. An island grows until it has room for all its plans, so
 *   the picture stays readable when the number of plans grows: bigger islands, never overlapping objects.
 * - Slots are filled from the front row (least mature, red) to the back row (most mature, green).
 */

export type XZ = [number, number];

export const SLOT_SPACING = 1.8; // distance between two objects
export const ISLAND_TOP = 0.5; // height of an island's surface above the sea
export const SEA_LEVEL = 0;
const BRIDGE_GAP = 3.2; // sea between two islands of the middle row
const ROW_GAP = 5.4; // sea between the rows
const MARGIN = 0.8; // objects stay this share of the way in from the shore

export interface Slot {
  slug: string;
  pos: XZ;
}

export interface Island {
  id: string;
  kind: string; // part kind: foundation | pillar | roof | annex
  center: XZ;
  rx: number;
  rz: number;
  outline: XZ[]; // the shore, in world x/z
  slots: Slot[];
  trees: XZ[];
  landmark: { center: XZ; halfW: number; halfD: number } | null; // a building that keeps its place free of objects
}

export interface Bridge {
  from: XZ;
  to: XZ;
}

export interface LandscapeLayout {
  islands: Record<string, Island>;
  row: string[]; // the four stage islands, left to right
  bridges: Bridge[];
  flows: [string, string][]; // dashed arrows along the audit flow
  supports: string[]; // islands the shared infrastructure supports with dashed arrows
  boats: { pos: XZ; heading: number }[];
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
}

export const slotIndexKey = (islandId: string, slug: string) => `${islandId}:${slug}`;

/** The slot of a plan on an island, or undefined. */
export function slotOf(layout: LandscapeLayout, islandId: string, slug: string): Slot | undefined {
  return layout.islands[islandId]?.slots.find((s) => s.slug === slug);
}

// ---- geometry helpers ---------------------------------------------------------------------------------------------

export function pointInPolygon(p: XZ, poly: XZ[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i];
    const [xj, zj] = poly[j];
    if (zi > p[1] !== zj > p[1] && p[0] < ((xj - xi) * (p[1] - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

const scaleAbout = (poly: XZ[], c: XZ, k: number): XZ[] => poly.map(([x, z]) => [c[0] + (x - c[0]) * k, c[1] + (z - c[1]) * k]);

/** An irregular, rounded shore around a centre: the same id always gives the same coastline. */
export function shoreline(id: string, center: XZ, rx: number, rz: number, points = 56): XZ[] {
  const seed = hashString(id);
  const phase = (i: number) => hash(seed + i * 17) * Math.PI * 2;
  const [p1, p2, p3] = [phase(1), phase(2), phase(3)];
  return Array.from({ length: points }, (_, i) => {
    const a = (i / points) * Math.PI * 2;
    const r = 1 + 0.06 * Math.sin(3 * a + p1) + 0.04 * Math.sin(5 * a + p2) + 0.05 * Math.sin(2 * a + p3);
    return [center[0] + rx * r * Math.cos(a), center[1] + rz * r * Math.sin(a)] as XZ;
  });
}

/** Hexagonal grid points inside a polygon, front row (largest z) first. */
function hexPoints(center: XZ, rx: number, rz: number, inner: XZ[], skip: (p: XZ) => boolean): XZ[] {
  const rowH = SLOT_SPACING * 0.866;
  const rows = Math.floor(rz / rowH);
  const out: XZ[] = [];
  for (let r = -rows; r <= rows; r++) {
    const z = center[1] + r * rowH;
    const offset = Math.abs(r) % 2 ? SLOT_SPACING / 2 : 0;
    const cols = Math.floor(rx / SLOT_SPACING) + 1;
    for (let c = -cols; c <= cols; c++) {
      const p: XZ = [center[0] + c * SLOT_SPACING + offset, z];
      if (pointInPolygon(p, inner) && !skip(p)) out.push(p);
    }
  }
  return out.sort((a, b) => b[1] - a[1] || a[0] - b[0]);
}

interface IslandSpec {
  id: string;
  kind: string;
  aspect: number; // width / depth of the island
  minRx: number;
  minRz: number;
  landmark: boolean; // keeps a place at the back for a building
  wantRx?: number; // at least this wide (the governance and infrastructure islands span the whole row)
}

/** Grow an island until all its plans fit; returns its size and the chosen slot positions (front to back). */
function growIsland(spec: IslandSpec, center: XZ, plans: number): { rx: number; rz: number; outline: XZ[]; slots: XZ[]; landmark: Island["landmark"] } {
  const base = Math.sqrt((Math.max(plans, 1) * SLOT_SPACING * SLOT_SPACING * 0.866) / (Math.PI * 0.62));
  let k = 0.85;
  for (let guard = 0; guard < 80; guard++, k *= 1.05) {
    let rx = Math.max(spec.minRx, base * k * Math.sqrt(spec.aspect));
    const rz = Math.max(spec.minRz, (base * k) / Math.sqrt(spec.aspect));
    if (spec.wantRx) rx = Math.max(rx, spec.wantRx);
    const outline = shoreline(spec.id, center, rx, rz);
    const inner = scaleAbout(outline, center, MARGIN);
    const landmark = spec.landmark ? { center: [center[0], center[1] - rz * 0.55] as XZ, halfW: 2.3, halfD: 1.5 } : null;
    const skip = (p: XZ) => !!landmark && Math.abs(p[0] - landmark.center[0]) < landmark.halfW && Math.abs(p[1] - landmark.center[1]) < landmark.halfD;
    const free = hexPoints(center, rx, rz, inner, skip);
    if (free.length >= plans) {
      // keep the n points nearest the middle (a compact cluster), then lay them out front to back
      const near = [...free].sort((a, b) => ((a[0] - center[0]) / rx) ** 2 + ((a[1] - center[1]) / rz) ** 2 - (((b[0] - center[0]) / rx) ** 2 + ((b[1] - center[1]) / rz) ** 2));
      const chosen = near.slice(0, plans).sort((a, b) => b[1] - a[1] || a[0] - b[0]);
      return { rx, rz, outline, slots: chosen, landmark };
    }
  }
  throw new Error(`island ${spec.id}: no room for ${plans} plans`);
}

/** Scattered trees on the free ground of an island. Fewer, or none, as the island fills up. */
function scatterTrees(id: string, outline: XZ[], center: XZ, taken: XZ[], landmark: Island["landmark"], max: number): XZ[] {
  const inner = scaleAbout(outline, center, 0.94);
  const xs = inner.map((p) => p[0]);
  const zs = inner.map((p) => p[1]);
  const [x0, x1, z0, z1] = [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)];
  const seed = hashString(id + ":trees");
  const out: XZ[] = [];
  for (let i = 0; i < max * 14 && out.length < max; i++) {
    const p: XZ = [x0 + (x1 - x0) * hash(seed + i * 2), z0 + (z1 - z0) * hash(seed + i * 2 + 1)];
    if (!pointInPolygon(p, inner)) continue;
    if (taken.some((t) => Math.hypot(t[0] - p[0], t[1] - p[1]) < SLOT_SPACING * 0.85)) continue;
    if (out.some((t) => Math.hypot(t[0] - p[0], t[1] - p[1]) < 1.1)) continue;
    if (landmark && Math.abs(p[0] - landmark.center[0]) < landmark.halfW + 0.4 && Math.abs(p[1] - landmark.center[1]) < landmark.halfD + 0.4) continue;
    out.push(p);
  }
  return out;
}

const MIDDLE_KIND = "pillar";

export function computeLandscape(data: ProgressData): LandscapeLayout {
  const planBySlug = new Map(data.plans.map((p) => [p.slug, p]));
  const plansOf = (part: PartRecord) => part.plans.map((s) => planBySlug.get(s)).filter((p): p is PlanRecord => !!p).sort(byMaturity);
  const parts = new Map(data.parts.map((p) => [p.id, p]));
  const stageParts = data.parts.filter((p) => p.kind === MIDDLE_KIND).sort((a, b) => a.position - b.position);
  const roof = data.parts.find((p) => p.kind === "roof");
  const foundation = data.parts.find((p) => p.kind === "foundation");
  const annex = parts.get("annex");

  // 1. the four stage islands, in a row, sized by their plans
  const sized = stageParts.map((p) => {
    const spec: IslandSpec = { id: p.id, kind: p.kind, aspect: 1.15, minRx: 3, minRz: 2.5, landmark: false };
    return { part: p, spec, ...growIsland(spec, [0, 0], plansOf(p).length) };
  });
  const rowWidth = sized.reduce((w, s) => w + 2 * s.rx, 0) + BRIDGE_GAP * Math.max(0, sized.length - 1);
  let cursor = -rowWidth / 2;
  const placed = sized.map((s) => {
    const center: XZ = [cursor + s.rx, 0];
    cursor += 2 * s.rx + BRIDGE_GAP;
    return { ...s, center };
  });
  const maxRz = Math.max(3, ...placed.map((s) => s.rz));

  const islands: Record<string, Island> = {};
  const add = (id: string, kind: string, center: XZ, plans: PlanRecord[], spec: IslandSpec, treeMax: number) => {
    const g = growIsland(spec, center, plans.length);
    const slots = g.slots.map((pos, i) => ({ slug: plans[i].slug, pos }));
    islands[id] = {
      id,
      kind,
      center,
      rx: g.rx,
      rz: g.rz,
      outline: g.outline,
      slots,
      trees: scatterTrees(id, g.outline, center, g.slots, g.landmark, treeMax),
      landmark: g.landmark,
    };
  };

  for (const s of placed) add(s.part.id, s.part.kind, s.center, plansOf(s.part), s.spec, 7);

  // 2. governance behind the row and the shared infrastructure in front of it, both as wide as the row
  const span = rowWidth * 0.72;
  if (roof) {
    const spec: IslandSpec = { id: roof.id, kind: roof.kind, aspect: 2.6, minRx: 5, minRz: 3.6, landmark: true, wantRx: span / 2 };
    const rz = growIsland(spec, [0, 0], plansOf(roof).length).rz;
    add(roof.id, roof.kind, [0, -(maxRz + rz + ROW_GAP)], plansOf(roof), spec, 12);
  }
  if (foundation) {
    const spec: IslandSpec = { id: foundation.id, kind: foundation.kind, aspect: 3, minRx: 5, minRz: 3.6, landmark: true, wantRx: span / 2 };
    const rz = growIsland(spec, [0, 0], plansOf(foundation).length).rz;
    add(foundation.id, foundation.kind, [0, maxRz + rz + ROW_GAP], plansOf(foundation), spec, 12);
  }

  // 3. the Repo Annex, a small island beside the row
  if (annex && annex.plans.length) {
    const spec: IslandSpec = { id: annex.id, kind: annex.kind, aspect: 1.2, minRx: 3, minRz: 2.5, landmark: false };
    const size = growIsland(spec, [0, 0], plansOf(annex).length);
    add(annex.id, annex.kind, [rowWidth / 2 + 4 + size.rx, 2], plansOf(annex), spec, 5);
  }

  const row = placed.map((s) => s.part.id);
  const bridges: Bridge[] = [];
  for (let i = 0; i + 1 < placed.length; i++) {
    bridges.push({ from: [placed[i].center[0] + placed[i].rx * 0.86, 0], to: [placed[i + 1].center[0] - placed[i + 1].rx * 0.86, 0] });
  }
  const flows = row.slice(0, -1).map((id, i) => [id, row[i + 1]] as [string, string]);

  const all = Object.values(islands);
  const bounds = {
    minX: Math.min(...all.map((i) => i.center[0] - i.rx)) - 1.5,
    maxX: Math.max(...all.map((i) => i.center[0] + i.rx)) + 1.5,
    minZ: Math.min(...all.map((i) => i.center[1] - i.rz)) - 1.5,
    maxZ: Math.max(...all.map((i) => i.center[1] + i.rz)) + 1.5,
  };
  const boats = [
    { pos: [bounds.minX + 2.5, maxRz + 1.4] as XZ, heading: 0.5 },
    { pos: [rowWidth * 0.18, maxRz + 1.3] as XZ, heading: -0.35 },
    { pos: [bounds.maxX - 3, bounds.minZ + 1.5] as XZ, heading: 2.4 },
  ];
  return { islands, row, bridges, flows, supports: foundation ? row : [], boats, bounds };
}

/** Above this many plans the first screen draws simple pawns instead of full objects (an island opens up in full detail). */
export const DETAIL_LIMIT = 140;
export const needsSimplerObjects = (planCount: number) => planCount > DETAIL_LIMIT;
