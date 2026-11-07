import type { PartRecord, PhaseKey, PlanRecord, ProgressData, RepoStatus, Rollup } from "./types";

const PHASES: PhaseKey[] = ["plan", "do", "check", "act"];
/**
 * What one phase (Plan, Do, Check or Act) of a plan counts for. A plan's score is the average of its four phases, and a
 * block's score is the average of its plans. These are the same numbers the generator writes into progress.json as
 * `weights` (PHASE_WEIGHTS in SAAF-Project tools/scripts/generate_dashboard.py), and "How this is calculated" shows them.
 */
const WEIGHT = {
  complete: 1, // the phase is done: counts in full
  in_progress: 0.5, // started but not finished: counts as half, so a plan does not look finished too early
  not_started: 0, // nothing yet: counts as zero
};

/** Same roll-up as tools/scripts/generate_dashboard.py: plans without a PDCA table are counted, not averaged. */
export function rollup(plans: PlanRecord[]): Rollup {
  const known = plans.filter((p) => p.pdca_known);
  const phases = { complete: 0, in_progress: 0, not_started: 0 };
  const sum: Record<PhaseKey, number> = { plan: 0, do: 0, check: 0, act: 0 };
  for (const p of known) {
    for (const ph of PHASES) {
      phases[p.pdca[ph]] += 1;
      sum[ph] += WEIGHT[p.pdca[ph]];
    }
  }
  const n = known.length;
  const repo_status: Partial<Record<RepoStatus, number>> = {};
  for (const p of plans) repo_status[p.repo_status] = (repo_status[p.repo_status] ?? 0) + 1;
  const round = (v: number) => Math.round(v * 1000) / 1000;
  return {
    plan_count: plans.length,
    plans_unknown: plans.length - n,
    progress: n ? round(known.reduce((s, p) => s + p.progress, 0) / n) : null,
    phase_progress: {
      plan: n ? round(sum.plan / n) : null,
      do: n ? round(sum.do / n) : null,
      check: n ? round(sum.check / n) : null,
      act: n ? round(sum.act / n) : null,
    },
    phases,
    repo_count: plans.filter((p) => p.repo).length,
    repo_status,
  };
}

/**
 * The Repo Annex is the seventh block of the temple. It is built from the generator's annex list, so it
 * behaves like every other part: a roll-up, a set of plans, a drill-down.
 */
export function withAnnexPart(data: ProgressData): ProgressData {
  if (data.parts.some((p) => p.id === "annex")) return data;
  const bySlug = new Map(data.plans.map((p) => [p.slug, p]));
  const plans = data.annex.items.map((i) => bySlug.get(i.plan)).filter((p): p is PlanRecord => !!p);
  const part: PartRecord = {
    id: "annex",
    kind: "annex",
    track: null,
    stage: "Repo Annex",
    position: 7,
    name: data.annex.name,
    mission:
      "Plans whose repository needs attention: possible duplicate repos, and agents built inside the main repository that should move to their own repo.",
    team: {},
    plans: plans.map((p) => p.slug),
    ...rollup(plans),
  };
  return { ...data, parts: [...data.parts, part] };
}
