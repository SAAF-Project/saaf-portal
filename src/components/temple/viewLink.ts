import { isActive, parseFilters } from "./filters";

/** Splits a link like `#/part/planning?stage=2&view=islands` into the place and the query. */
export const splitHash = (hash: string): [string, string] => {
  const [path, query = ""] = hash.replace(/^#/, "").split("?");
  return [path, query];
};

export const viewFromHash = (hash: string): string | null => new URLSearchParams(splitHash(hash)[1]).get("view");

/**
 * Which view a visit opens, or null when the chooser should show:
 * 1. the view the link asks for (view=<id>);
 * 2. the view this person picked before;
 * 3. the first view, for an old link that points at a block or carries filters (it was made before there was a chooser);
 * 4. otherwise nothing: a first visit sees the chooser, and the link stays clean until someone picks.
 */
export function startingView(viewIds: string[], hash: string, remembered: string | null): string | null {
  const linked = viewFromHash(hash);
  if (linked && viewIds.includes(linked)) return linked;
  if (remembered && viewIds.includes(remembered)) return remembered;
  const [path, query] = splitHash(hash);
  const oldDeepLink = path.replace(/^\//, "") !== "" || isActive(parseFilters(query));
  return oldDeepLink ? (viewIds[0] ?? null) : null;
}
