import type { PlanRecord, Severity } from "./types";

/**
 * Alerts are decided by the generator (tools/scripts/generate_dashboard.py, ALERT_CATALOG). On a piece they show
 * as one corner tag by the worst severity: an error (violet) or a warning (indigo). Info alerts are listed in the
 * panel and can be filtered on, but get no tag: some are true for most plans (56 of 66 still say Draft), and a tag
 * on nearly every piece would tell nothing.
 */
export const ALERT_COLOR: Record<Severity, string> = {
  error: "#a58df2", // soft violet
  warning: "#6f7ff0", // soft indigo
  info: "#a3aec2",
};

export const SEVERITY_LABEL: Record<Severity, string> = { error: "Conflict", warning: "Warning", info: "Note" };

const RANK: Record<Severity, number> = { error: 2, warning: 1, info: 0 };

/** The worst severity among the plan's alerts that deserve a tag (error or warning), or null. */
export function tagSeverity(plan: Pick<PlanRecord, "alerts">): Severity | null {
  let worst: Severity | null = null;
  for (const a of plan.alerts) {
    if (a.severity !== "info" && (worst === null || RANK[a.severity] > RANK[worst])) worst = a.severity;
  }
  return worst;
}

/** Sort key: worst first. */
export const severityRank = (s: Severity) => RANK[s];

export const hasAlert = (plan: Pick<PlanRecord, "alerts">, id: string) => plan.alerts.some((a) => a.id === id);
