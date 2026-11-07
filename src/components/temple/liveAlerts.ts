import type { AlertDefinition, AlertRecord, PlanRecord, ProgressData } from "./types";

/**
 * Alerts that need the state of the plan's repo on GitHub, so the generator (which only reads plan files) cannot
 * decide them. The host fetches one RepoSignal per linked repo and passes them in; this module turns them into the
 * same AlertRecords the generator makes, so the rest of the UI (tags, panel, filters) needs no special case.
 *
 * Missing information is never an alert: a signal field that is null means "not checked" (fetch failed, repo too
 * big to list, no need to look), and then nothing is raised.
 */
export interface RepoSignal {
  name: string; // repo name in the org, as plan.repo.name
  archived: boolean;
  pushedAt: string | null; // ISO timestamp of the last push
  hasAuditCriteria: boolean | null; // AUDIT-CRITERIA.md in the repo root
  hasTests: boolean | null; // a test folder or test files somewhere in the repo
}

export interface RepoSignals {
  /** True when the full list of org repos was read, so a repo that is not in `repos` really does not exist. */
  listed: boolean;
  repos: Record<string, RepoSignal>; // key: lower-case repo name
  checked_at: string;
}

export const INACTIVE_DAYS = 90;
const MIN_STAGE_AUDIT_CRITERIA = 3; // Ready
const MIN_STAGE_TESTS = 4; // Tested
const MIN_STAGE_ACTIVE = 2; // Building

export const LIVE_ALERT_CATALOG: AlertDefinition[] = [
  { id: "repo-unreachable", severity: "warning", label: "Repo not found or archived", hint: "The linked repo is not in the SAAF-Project organisation, or it is archived: fix the link or unarchive it" },
  { id: "repo-no-audit-criteria", severity: "warning", label: "No AUDIT-CRITERIA.md", hint: "The agent is Ready or further, but its repo has no AUDIT-CRITERIA.md next to the README (SAAF rule for every agent repo)" },
  { id: "repo-no-tests", severity: "warning", label: "No tests in the repo", hint: "The agent is Tested or further, but no test folder or test files were found in its repo" },
  { id: "repo-inactive", severity: "info", label: `Repo quiet for ${INACTIVE_DAYS}+ days`, hint: "Work is under way, but nothing was pushed to the repo for a long time: is the plan still being worked on?" },
];

const LIVE_IDS = new Set(LIVE_ALERT_CATALOG.map((a) => a.id));
const severityOf = (id: string) => LIVE_ALERT_CATALOG.find((a) => a.id === id)!.severity;

/** The live alerts of one plan, given the signals of its repo. Pure; `now` is injected for tests. */
export function liveAlertsFor(plan: Pick<PlanRecord, "repo" | "kind" | "stage">, signals: RepoSignals, now: Date): AlertRecord[] {
  if (!plan.repo) return [];
  const alert = (id: string, message: string): AlertRecord => ({ id, severity: severityOf(id), message });
  const signal = signals.repos[plan.repo.name.toLowerCase()];

  if (!signal) {
    // only conclude "not found" when the whole list was read
    return signals.listed ? [alert("repo-unreachable", `The linked repo ${plan.repo.name} was not found in the SAAF-Project organisation.`)] : [];
  }

  const out: AlertRecord[] = [];
  if (signal.archived) out.push(alert("repo-unreachable", `The linked repo ${signal.name} is archived.`));
  if (plan.kind === "agent" && plan.stage >= MIN_STAGE_AUDIT_CRITERIA && signal.hasAuditCriteria === false) {
    out.push(alert("repo-no-audit-criteria", `The plan is at stage ${plan.stage + 1} of 6, but ${signal.name} has no AUDIT-CRITERIA.md.`));
  }
  if (plan.kind === "agent" && plan.stage >= MIN_STAGE_TESTS && signal.hasTests === false) {
    out.push(alert("repo-no-tests", `The plan says tested, but no tests were found in ${signal.name}.`));
  }
  if (plan.stage >= MIN_STAGE_ACTIVE && !signal.archived && signal.pushedAt) {
    const days = Math.floor((now.getTime() - new Date(signal.pushedAt).getTime()) / 86_400_000);
    if (days > INACTIVE_DAYS) out.push(alert("repo-inactive", `Nothing was pushed to ${signal.name} for ${days} days (last push ${signal.pushedAt.slice(0, 10)}).`));
  }
  return out;
}

/** Which repos need a closer look (tree listing) to decide the live alerts: the agents that claim to be Ready or further. */
export function reposToInspect(plans: Pick<PlanRecord, "repo" | "kind" | "stage">[]): string[] {
  const names = new Set<string>();
  for (const p of plans) if (p.repo && p.kind === "agent" && p.stage >= MIN_STAGE_AUDIT_CRITERIA) names.add(p.repo.name);
  return [...names];
}

/**
 * Returns a copy of the progress data with the live alerts added to the plans (and their definitions to the
 * catalog). Idempotent: live alerts already on a plan are replaced, not doubled.
 */
export function applyRepoSignals(data: ProgressData, signals: RepoSignals | null, now: Date = new Date()): ProgressData {
  const base = data.alert_catalog.filter((a) => !LIVE_IDS.has(a.id));
  if (!signals) return { ...data, alert_catalog: base, plans: data.plans.map((p) => ({ ...p, alerts: p.alerts.filter((a) => !LIVE_IDS.has(a.id)) })) };
  const order = new Map([...base, ...LIVE_ALERT_CATALOG].map((a, i) => [a.id, i]));
  const plans = data.plans.map((p) => {
    const alerts = [...p.alerts.filter((a) => !LIVE_IDS.has(a.id)), ...liveAlertsFor(p, signals, now)];
    alerts.sort((a, b) => (order.get(a.id) ?? 99) - (order.get(b.id) ?? 99));
    return { ...p, alerts };
  });
  return { ...data, alert_catalog: [...base, ...LIVE_ALERT_CATALOG], plans };
}
