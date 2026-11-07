import bundled from "./relations.json";
import type { PlanRecord, ProgressData, Relation, RelationSource, RelationStatus, RelationsFile } from "./types";

/**
 * Which plan's output is another plan's input. Until the plan owners decide where this belongs, the list lives in
 * relations.json next to this module (so it travels with it into the portal). When the generator writes `relations`
 * into progress.json, that list wins.
 */
export const BUNDLED_RELATIONS = bundled as RelationsFile;

/** One arrow: `from` produces something that `to` uses. Duplicates are merged, unknown plans dropped. */
export interface RelationEdge {
  from: string;
  to: string;
  what: string;
  status: RelationStatus;
  sources: RelationSource[];
  note?: string;
}

// The disclaimer, in one place: the view, the side panel and the information screen all say the same thing.
export const DISCLAIMER = {
  title: "AI suggestions, not confirmed dependencies",
  text: "These relationships are AI suggestions read from the plan texts, not confirmed dependencies. Accurate results need plan owners to document inputs and outputs in their plans and repos.",
  panel: "AI-suggested from the plan text; not confirmed by the owner.",
};

export const relationsFor = (data: ProgressData): Relation[] => data.relations ?? BUNDLED_RELATIONS.relations;

/** Checks the list against the plans: drops unknown slugs and self-loops, merges duplicate pairs. */
export function cleanRelations(list: Relation[], plans: Pick<PlanRecord, "slug">[]): { edges: RelationEdge[]; warnings: string[] } {
  const known = new Set(plans.map((p) => p.slug));
  const warnings: string[] = [];
  const byPair = new Map<string, RelationEdge>();
  for (const r of list) {
    if (!known.has(r.from) || !known.has(r.to)) {
      warnings.push(`relation ${r.from} -> ${r.to}: unknown plan ${known.has(r.from) ? r.to : r.from}`);
      continue;
    }
    if (r.from === r.to) {
      warnings.push(`relation ${r.from} -> ${r.to}: a plan cannot feed itself`);
      continue;
    }
    const key = `${r.from}|${r.to}`;
    const seen = byPair.get(key);
    if (!seen) {
      byPair.set(key, { from: r.from, to: r.to, what: r.what ?? "", status: r.status === "confirmed" ? "confirmed" : "suggested", sources: [...(r.sources ?? [])], note: r.note });
      continue;
    }
    // the same pair twice: one arrow, both labels, all sources; confirmed if either is
    if (r.what && !seen.what.split(", ").includes(r.what)) seen.what = seen.what ? `${seen.what}, ${r.what}` : r.what;
    seen.sources.push(...(r.sources ?? []));
    if (r.status === "confirmed") seen.status = "confirmed";
    if (r.note) seen.note = seen.note ? `${seen.note} ${r.note}` : r.note;
  }
  return { edges: [...byPair.values()], warnings };
}

/** What a plan gets and from whom (inputs), and what it gives to whom (outputs). */
export function relationsOf(slug: string, edges: RelationEdge[]): { inputs: RelationEdge[]; outputs: RelationEdge[] } {
  return { inputs: edges.filter((e) => e.to === slug), outputs: edges.filter((e) => e.from === slug) };
}
