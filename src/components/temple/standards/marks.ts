import type { PlanRecord } from "../types";

// Which plan a repo belongs to, as far as the plans say so. The Standards view of SAAF Visualised reads the repos from
// /api/standards and the plans from the shared engine; this joins the two in the browser, on the repo name.
// Pure: no React, so the tests can use it.

export interface RepoMark {
  slug: string;
  title: string;
  /** Index into the stages (see ../stages.ts), as decided by the generator. */
  stage: number;
  /** True when the repo is the plan's own repo, false when it is one of the plan's alternatives. */
  primary: boolean;
}

type PlanRepos = Pick<PlanRecord, "slug" | "title" | "stage" | "repo" | "repo_alternatives">;

/** What repos are joined on: the bare name in lower case. GitHub names ignore case, and a plan may write owner/name. */
export const repoKey = (name: string): string => name.trim().toLowerCase().split("/").pop() ?? "";

/**
 * The plan behind each repo, by repo key. A plan's own repo wins over a repo that another plan only lists as an
 * alternative; between two equal claims the first plan in the list wins, so the answer is the same on every load.
 */
export function marksFromPlans(plans: PlanRepos[]): Map<string, RepoMark> {
  const marks = new Map<string, RepoMark>();
  const claim = (name: string, plan: PlanRepos, primary: boolean) => {
    const key = repoKey(name);
    if (!key) return;
    const held = marks.get(key);
    if (held && (held.primary || !primary)) return;
    marks.set(key, { slug: plan.slug, title: plan.title || plan.slug, stage: plan.stage, primary });
  };
  for (const plan of plans) {
    if (plan.repo) claim(plan.repo.name, plan, true);
    for (const alternative of plan.repo_alternatives ?? []) claim(alternative.name, plan, false);
  }
  return marks;
}

/**
 * The repo on the wall that stands for a plan: its own repo when that one is there, otherwise the first of its
 * alternatives in the order of the wall. Undefined when none of the plan's repos is on the wall.
 */
export function repoForPlan(names: string[], marks: Map<string, RepoMark>, slug: string): string | undefined {
  const linked = names.filter((name) => marks.get(repoKey(name))?.slug === slug);
  return linked.find((name) => marks.get(repoKey(name))?.primary) ?? linked[0];
}
