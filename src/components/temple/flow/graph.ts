/**
 * The relations as a directed graph, and what the flow diagram needs from it: columns that follow the order of the
 * work (every arrow points right), and the whole chain of a plan. Pure and deterministic: the same input always gives
 * the same picture.
 */

export interface Link {
  from: string;
  to: string;
}

export interface Graph {
  nodes: string[]; // sorted
  out: Map<string, string[]>; // sorted
  in: Map<string, string[]>; // sorted
}

export const linkKey = (l: Link) => `${l.from}|${l.to}`;

export function buildGraph(nodes: string[], links: Link[]): Graph {
  const sorted = [...new Set(nodes)].sort();
  const out = new Map(sorted.map((n) => [n, [] as string[]]));
  const inn = new Map(sorted.map((n) => [n, [] as string[]]));
  for (const { from, to } of links) {
    if (!out.has(from) || !inn.has(to) || from === to) continue;
    if (!out.get(from)!.includes(to)) out.get(from)!.push(to);
    if (!inn.get(to)!.includes(from)) inn.get(to)!.push(from);
  }
  for (const list of [...out.values(), ...inn.values()]) list.sort();
  return { nodes: sorted, out, in: inn };
}

/**
 * Links that close a cycle (a plan that, through others, feeds back into itself). Found by a depth-first search in
 * name order, so always the same ones. Drawing them backwards keeps every other arrow pointing right.
 */
export function backLinks(g: Graph): Set<string> {
  const state = new Map<string, 0 | 1 | 2>(); // 0 new, 1 on the current path, 2 done
  const back = new Set<string>();
  const visit = (n: string) => {
    state.set(n, 1);
    for (const m of g.out.get(n) ?? []) {
      const s = state.get(m) ?? 0;
      if (s === 1) back.add(linkKey({ from: n, to: m }));
      else if (s === 0) visit(m);
    }
    state.set(n, 2);
  };
  for (const n of g.nodes) if (!state.get(n)) visit(n);
  return back;
}

/** Column of every node: the length of the longest path into it, with back links turned around. */
export function columns(g: Graph, back: Set<string>): Map<string, number> {
  const preds = new Map(g.nodes.map((n) => [n, [] as string[]]));
  for (const n of g.nodes) {
    for (const m of g.out.get(n) ?? []) {
      if (back.has(linkKey({ from: n, to: m }))) preds.get(n)!.push(m);
      else preds.get(m)!.push(n);
    }
  }
  const col = new Map<string, number>();
  const depth = (n: string): number => {
    const known = col.get(n);
    if (known !== undefined) return known;
    col.set(n, 0); // guard; the graph is acyclic once back links are turned around
    const d = Math.max(0, ...preds.get(n)!.map((p) => depth(p) + 1));
    col.set(n, d);
    return d;
  };
  for (const n of g.nodes) depth(n);
  return col;
}

/** A plan's whole chain: everything it depends on, everything that depends on it, and the plan itself. */
export function chainOf(slug: string, g: Graph): Set<string> {
  const chain = new Set<string>([slug]);
  // upstream and downstream are walked separately, so a sibling (another input of the same plan) is not pulled in
  for (const dir of [g.in, g.out]) {
    const seen = new Set<string>([slug]);
    const queue = [slug];
    while (queue.length) {
      const n = queue.shift()!;
      for (const m of dir.get(n) ?? []) {
        if (!seen.has(m)) {
          seen.add(m);
          chain.add(m);
          queue.push(m);
        }
      }
    }
  }
  return chain;
}

/** Plans that take part in no relation at all. */
export function unlinked(slugs: string[], links: Link[]): string[] {
  const linked = new Set(links.flatMap((l) => [l.from, l.to]));
  return slugs.filter((s) => !linked.has(s));
}
