import type { RelationEdge } from "../relations";
import type { PartRecord, PlanRecord } from "../types";
import { backLinks, buildGraph, columns, linkKey } from "./graph";

/**
 * Layout of the dependency map: one horizontal lane per part (governance on top, the four audit stages in the reverse
 * order of the other views, the shared infrastructure at the bottom), and columns that follow the order of the work, so every arrow points
 * right. Inside a lane, the cards of a column are ordered to keep arrows from crossing. Plans without any relation sit
 * in a compact grid at the end of their lane, behind a dashed line, and only when asked for.
 */

export const CARD_W = 184;
export const CARD_H = 58;
const COL_GAP = 100; // room for the arrows and their labels between columns
const ROW_GAP = 16;
const LANE_PAD = 18;
export const LABEL_W = 220; // lane names on the left
const EMPTY_LANE_H = 46;
const UNLINKED_GAP = 40; // extra space before the grid of plans without relations
const UNLINKED_ROWS = 3;

// Top to bottom. The four audit stages run in the reverse of the order they have in the other views (planning,
// collection, reporting, monitoring from left to right there), so the lanes read like the temple built up from below.
export const LANE_ORDER = ["governance", "monitoring", "reporting", "collection", "planning", "foundation"];

export interface Card {
  slug: string;
  lane: string;
  x: number;
  y: number;
  w: number;
  h: number;
  col: number; // -1 for a plan without relations
  linked: boolean;
}

export interface Lane {
  id: string;
  label: string;
  y: number;
  h: number;
  shown: number; // cards drawn in this lane
  hidden: number; // plans without relations that are not drawn
}

export interface Arrow {
  from: string;
  to: string;
  what: string;
  status: RelationEdge["status"];
  back: boolean; // closes a cycle: drawn as a loop over the cards
  d: string; // SVG path
  mid: [number, number]; // where the label goes
}

export interface FlowLayout {
  cards: Record<string, Card>;
  lanes: Lane[];
  arrows: Arrow[];
  width: number;
  height: number;
  unlinkedX: number | null; // the dashed line before the plans without relations
  crossings: { before: number; after: number };
}

type Cells = Map<string, Map<number, string[]>>; // lane -> column -> slugs, top to bottom

const rowsOf = (lane: Map<number, string[]> | undefined) => Math.max(0, ...[...(lane?.values() ?? [])].map((c) => c.length));

/** Vertical rank of every node (lane order, then its place in the column, centred like the drawing). */
function ranks(cells: Cells, lanes: string[]): Map<string, number> {
  const r = new Map<string, number>();
  let base = 0;
  for (const id of lanes) {
    const lane = cells.get(id);
    const rows = Math.max(1, rowsOf(lane));
    for (const list of lane?.values() ?? []) list.forEach((s, i) => r.set(s, base + (rows - list.length) / 2 + i));
    base += rows + 1;
  }
  return r;
}

/** Pairs of arrows whose order flips between their shared columns (a good stand-in for crossings). */
export function countCrossings(links: { from: string; to: string }[], col: Map<string, number>, rank: Map<string, number>): number {
  const segs = links.map((l) => {
    const [a, b] = col.get(l.from)! <= col.get(l.to)! ? [l.from, l.to] : [l.to, l.from];
    return { c0: col.get(a)!, c1: col.get(b)!, y0: rank.get(a)!, y1: rank.get(b)!, ends: [a, b] };
  });
  const at = (s: (typeof segs)[number], c: number) => (s.c1 === s.c0 ? s.y0 : s.y0 + ((s.y1 - s.y0) * (c - s.c0)) / (s.c1 - s.c0));
  let n = 0;
  for (let i = 0; i < segs.length; i++) {
    for (let j = i + 1; j < segs.length; j++) {
      const [a, b] = [segs[i], segs[j]];
      if (a.ends.some((e) => b.ends.includes(e))) continue; // arrows that share a card meet, they do not cross
      const lo = Math.max(a.c0, b.c0), hi = Math.min(a.c1, b.c1);
      if (lo >= hi) continue;
      if ((at(a, lo) - at(b, lo)) * (at(a, hi) - at(b, hi)) < 0) n++;
    }
  }
  return n;
}

const clone = (cells: Cells): Cells => new Map([...cells].map(([k, v]) => [k, new Map([...v].map(([c, l]) => [c, [...l]]))]));

/** Barycentre sweeps: each column is sorted by the average height of its neighbours; an order is kept only if it crosses less. */
function order(cells: Cells, lanes: string[], col: Map<string, number>, links: { from: string; to: string }[], maxCol: number) {
  const preds = new Map<string, string[]>(), succs = new Map<string, string[]>();
  for (const l of links) {
    (preds.get(l.to) ?? preds.set(l.to, []).get(l.to)!).push(l.from);
    (succs.get(l.from) ?? succs.set(l.from, []).get(l.from)!).push(l.to);
  }
  const before = countCrossings(links, col, ranks(cells, lanes));
  let best = { cells: clone(cells), n: before };
  const current = clone(cells);
  for (let sweep = 0; sweep < 8 && best.n > 0; sweep++) {
    const forward = sweep % 2 === 0;
    const cols = [...Array(maxCol + 1).keys()];
    for (const c of forward ? cols : cols.reverse()) {
      const r = ranks(current, lanes);
      for (const lane of current.values()) {
        const list = lane.get(c);
        if (!list || list.length < 2) continue;
        const bary = (s: string) => {
          const ns = (forward ? preds.get(s) : succs.get(s)) ?? [];
          return ns.length ? ns.reduce((sum, n) => sum + r.get(n)!, 0) / ns.length : r.get(s)!;
        };
        const keyed = list.map((s) => ({ s, b: bary(s) }));
        keyed.sort((x, y) => x.b - y.b || x.s.localeCompare(y.s));
        lane.set(c, keyed.map((k) => k.s));
      }
    }
    const n = countCrossings(links, col, ranks(current, lanes));
    if (n < best.n) best = { cells: clone(current), n };
  }
  return { cells: best.cells, before, after: best.n };
}

const bezierMid = (p: number[][]): [number, number] => [0, 1].map((k) => (p[0][k] + 3 * p[1][k] + 3 * p[2][k] + p[3][k]) / 8) as [number, number];
const fmt = (n: number) => Math.round(n * 10) / 10;
const hashKey = (s: string) => [...s].reduce((h, ch) => (Math.imul(h, 31) + ch.charCodeAt(0)) >>> 0, 7);

export interface FlowOptions {
  showUnlinked: boolean;
  keep?: string; // a plan to draw even when it has no relations and those are hidden (the selected one)
}

export function computeFlow(plans: PlanRecord[], parts: PartRecord[], edges: RelationEdge[], opts: FlowOptions): FlowLayout {
  const partOf = new Map(plans.map((p) => [p.slug, p.part]));
  const laneIds = [
    ...LANE_ORDER.filter((id) => parts.some((p) => p.id === id)),
    ...parts.filter((p) => p.kind !== "annex" && p.plan_count > 0 && !LANE_ORDER.includes(p.id)).map((p) => p.id),
  ];
  const laneSet = new Set(laneIds);
  const links = edges.filter((e) => laneSet.has(partOf.get(e.from) ?? "") && laneSet.has(partOf.get(e.to) ?? ""));
  const linked = [...new Set(links.flatMap((l) => [l.from, l.to]))];
  const g = buildGraph(linked, links);
  const back = backLinks(g);
  const col = columns(g, back);
  const maxCol = Math.max(-1, ...col.values());

  // linked plans in their lane and column, first by name; then ordered to cut crossings
  let cells: Cells = new Map(laneIds.map((id) => [id, new Map()]));
  for (const s of [...linked].sort()) {
    const lane = cells.get(partOf.get(s)!)!;
    const c = col.get(s)!;
    lane.set(c, [...(lane.get(c) ?? []), s]);
  }
  const ordered = order(cells, laneIds, col, links, maxCol);
  cells = ordered.cells;

  const linkedSet = new Set(linked);
  const loose = new Map(laneIds.map((id) => [id, [] as string[]]));
  for (const p of plans) {
    if (linkedSet.has(p.slug) || !laneSet.has(p.part)) continue;
    if (opts.showUnlinked || p.slug === opts.keep) loose.get(p.part)!.push(p.slug);
  }
  const hiddenIn = (id: string) => plans.filter((p) => p.part === id && !linkedSet.has(p.slug)).length - loose.get(id)!.length;

  const colX = (c: number) => LABEL_W + c * (CARD_W + COL_GAP);
  const anyLoose = [...loose.values()].some((l) => l.length);
  const unlinkedX = anyLoose ? colX(maxCol + 1) - COL_GAP / 2 + (maxCol >= 0 ? UNLINKED_GAP / 2 : 0) : null;
  const looseX0 = maxCol >= 0 ? colX(maxCol + 1) + UNLINKED_GAP : LABEL_W;

  const cards: Record<string, Card> = {};
  const lanes: Lane[] = [];
  let y = 0;
  let width = LABEL_W;
  for (const id of laneIds) {
    const lane = cells.get(id)!;
    const extra = loose.get(id)!;
    const linkedRows = rowsOf(lane);
    const looseRows = extra.length ? Math.max(linkedRows, Math.min(extra.length, UNLINKED_ROWS)) : 0;
    const rows = Math.max(linkedRows, looseRows);
    const h = rows ? 2 * LANE_PAD + rows * CARD_H + (rows - 1) * ROW_GAP : EMPTY_LANE_H;
    const step = CARD_H + ROW_GAP;
    for (const [c, list] of lane) {
      list.forEach((s, i) => {
        cards[s] = { slug: s, lane: id, x: colX(c), y: y + LANE_PAD + ((rows - list.length) / 2) * step + i * step, w: CARD_W, h: CARD_H, col: c, linked: true };
      });
    }
    extra.forEach((s, i) => {
      const gc = Math.floor(i / looseRows), gr = i % looseRows;
      cards[s] = { slug: s, lane: id, x: looseX0 + gc * (CARD_W + ROW_GAP), y: y + LANE_PAD + gr * step, w: CARD_W, h: CARD_H, col: -1, linked: false };
    });
    const part = parts.find((p) => p.id === id)!;
    lanes.push({ id, label: part.stage ?? part.name, y, h, shown: Object.values(cards).filter((c) => c.lane === id).length, hidden: hiddenIn(id) });
    y += h;
  }
  for (const c of Object.values(cards)) width = Math.max(width, c.x + c.w);

  // ports: arrows leave a card on the right and arrive on the left, spread out and sorted by the other end's height
  const outs = new Map<string, RelationEdge[]>(), ins = new Map<string, RelationEdge[]>();
  for (const e of links) {
    if (back.has(linkKey(e))) continue;
    (outs.get(e.from) ?? outs.set(e.from, []).get(e.from)!).push(e);
    (ins.get(e.to) ?? ins.set(e.to, []).get(e.to)!).push(e);
  }
  const centreY = (s: string) => cards[s].y + cards[s].h / 2;
  const portY = (list: RelationEdge[] | undefined, e: RelationEdge, card: Card, other: (x: RelationEdge) => string) => {
    const sorted = [...(list ?? [])].sort((a, b) => centreY(other(a)) - centreY(other(b)) || other(a).localeCompare(other(b)));
    const i = sorted.indexOf(e);
    return card.y + (card.h * (i + 1)) / (sorted.length + 1);
  };

  const arrows: Arrow[] = links.map((e) => {
    const a = cards[e.from], b = cards[e.to];
    const isBack = back.has(linkKey(e));
    let pts: number[][];
    if (isBack) {
      // a loop over the top: from the top of the later card back to the top of the earlier one
      const x1 = a.x + a.w * 0.35, y1 = a.y, x2 = b.x + b.w * 0.65, y2 = b.y;
      const lift = Math.min(y1, y2) - 46 - 0.06 * Math.abs(x1 - x2);
      pts = [[x1, y1], [x1, lift], [x2, lift], [x2, y2]];
    } else {
      const x1 = a.x + a.w, y1 = portY(outs.get(e.from), e, a, (x) => x.to);
      const x2 = b.x, y2 = portY(ins.get(e.to), e, b, (x) => x.from);
      const dx = Math.max(40, (x2 - x1) / 2);
      // an arrow that skips columns arches over (or under) the cards in between instead of running through them;
      // the direction alternates per arrow so a bundle fans out
      const span = b.col - a.col;
      const arch = span >= 2 ? (CARD_H * 0.9 + 22 * (span - 2)) * (hashKey(linkKey(e)) % 2 ? 1 : -1) : 0;
      pts = [[x1, y1], [x1 + dx, y1 + arch], [x2 - dx, y2 + arch], [x2, y2]];
    }
    const d = `M${fmt(pts[0][0])} ${fmt(pts[0][1])}C${pts.slice(1).map((p) => `${fmt(p[0])} ${fmt(p[1])}`).join(" ")}`;
    return { from: e.from, to: e.to, what: e.what, status: e.status, back: isBack, d, mid: bezierMid(pts) };
  });

  return { cards, lanes, arrows, width: width + 40, height: y, unlinkedX, crossings: { before: ordered.before, after: ordered.after } };
}
