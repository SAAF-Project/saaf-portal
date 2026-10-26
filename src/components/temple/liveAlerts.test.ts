import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { applyRepoSignals, INACTIVE_DAYS, liveAlertsFor, LIVE_ALERT_CATALOG, reposToInspect, type RepoSignal, type RepoSignals } from "./liveAlerts";
import type { ProgressData } from "./types";

const data = JSON.parse(readFileSync(resolve(process.cwd(), "public/data/progress.json"), "utf8")) as ProgressData;
const NOW = new Date("2026-10-08T00:00:00Z");

const repo = (name = "my-agent") => ({ name, url: `https://github.com/SAAF-Project/${name}`, source: "text-link" });
const plan = (stage: number, kind: "agent" | "workflow" = "agent", name = "my-agent") => ({ repo: repo(name), kind, stage });
const signal = (over: Partial<RepoSignal> = {}): RepoSignal => ({ name: "my-agent", archived: false, pushedAt: "2026-10-01T00:00:00Z", hasAuditCriteria: true, hasTests: true, ...over });
const signals = (s: RepoSignal | null, listed = true): RepoSignals => ({ listed, repos: s ? { [s.name.toLowerCase()]: s } : {}, checked_at: NOW.toISOString() });
const ids = (p: ReturnType<typeof plan>, s: RepoSignals) => liveAlertsFor(p, s, NOW).map((a) => a.id);

describe("live repo alerts", () => {
  it("raises nothing for a healthy repo", () => {
    expect(ids(plan(5), signals(signal()))).toEqual([]);
  });

  it("flags a missing AUDIT-CRITERIA.md from Ready on, for agents only", () => {
    const s = signals(signal({ hasAuditCriteria: false }));
    expect(ids(plan(2), s)).toEqual([]); // still building
    expect(ids(plan(3), s)).toEqual(["repo-no-audit-criteria"]);
    expect(ids(plan(3, "workflow"), s)).toEqual([]);
  });

  it("flags missing tests from Tested on", () => {
    const s = signals(signal({ hasTests: false }));
    expect(ids(plan(3), s)).toEqual([]);
    expect(ids(plan(4), s)).toEqual(["repo-no-tests"]);
  });

  it("never raises an alert for something that was not checked", () => {
    const s = signals(signal({ hasAuditCriteria: null, hasTests: null, pushedAt: null }));
    expect(ids(plan(5), s)).toEqual([]);
  });

  it("flags a quiet repo only while work is under way", () => {
    const old = signals(signal({ pushedAt: "2026-04-01T00:00:00Z" }));
    expect(ids(plan(1), old)).toEqual([]); // still a plan
    expect(ids(plan(2), old)).toEqual(["repo-inactive"]);
    const edge = new Date(NOW.getTime() - INACTIVE_DAYS * 86_400_000).toISOString();
    expect(ids(plan(2), signals(signal({ pushedAt: edge })))).toEqual([]); // exactly the threshold is not yet quiet
  });

  it("flags a repo that is archived, or not in the organisation when the full list was read", () => {
    expect(ids(plan(2), signals(signal({ archived: true })))).toEqual(["repo-unreachable"]);
    expect(ids(plan(2), signals(null))).toEqual(["repo-unreachable"]);
    expect(ids(plan(2), signals(null, false))).toEqual([]); // list unavailable: no false alarm
  });

  it("ignores plans without a repo and matches repo names case-insensitively", () => {
    expect(liveAlertsFor({ repo: null, kind: "agent", stage: 5 }, signals(null), NOW)).toEqual([]);
    expect(ids(plan(3, "agent", "My-Agent"), signals(signal({ hasAuditCriteria: false })))).toEqual(["repo-no-audit-criteria"]);
  });

  it("only inspects the repos of agents that are Ready or further", () => {
    expect(reposToInspect([plan(2), plan(3, "agent", "a"), plan(5, "workflow", "b"), { repo: null, kind: "agent", stage: 5 }])).toEqual(["a"]);
  });
});

describe("applyRepoSignals", () => {
  const withRepo = data.plans.filter((p) => p.repo && p.stage >= 2);
  const everyRepo = (over: Partial<RepoSignal>): RepoSignals => ({
    listed: true,
    checked_at: NOW.toISOString(),
    repos: Object.fromEntries(withRepo.map((p) => [p.repo!.name.toLowerCase(), signal({ name: p.repo!.name, ...over })])),
  });

  it("does not change the data without signals, and never mutates its input", () => {
    const before = JSON.stringify(data);
    const out = applyRepoSignals(data, null, NOW);
    expect(JSON.stringify(out)).toBe(JSON.stringify(data));
    applyRepoSignals(data, everyRepo({ hasAuditCriteria: false }), NOW);
    expect(JSON.stringify(data)).toBe(before);
  });

  it("adds the live alerts and their definitions, once", () => {
    const s = everyRepo({ hasAuditCriteria: false, hasTests: false, pushedAt: "2026-01-01T00:00:00Z" });
    const once = applyRepoSignals(data, s, NOW);
    const twice = applyRepoSignals(once, s, NOW);
    expect(twice).toEqual(once);
    expect(once.alert_catalog.map((a) => a.id)).toEqual([...data.alert_catalog.map((a) => a.id), ...LIVE_ALERT_CATALOG.map((a) => a.id)]);
    const raised = once.plans.flatMap((p) => p.alerts.map((a) => a.id));
    expect(raised).toContain("repo-no-audit-criteria");
    expect(raised).toContain("repo-inactive");
    // every raised alert is defined in the catalog with the same severity
    const catalog = new Map(once.alert_catalog.map((a) => [a.id, a.severity]));
    for (const p of once.plans) for (const a of p.alerts) expect(catalog.get(a.id)).toBe(a.severity);
  });

  it("removes the live alerts again when the signals are gone", () => {
    const withLive = applyRepoSignals(data, everyRepo({ hasAuditCriteria: false }), NOW);
    expect(applyRepoSignals(withLive, null, NOW)).toEqual(data);
  });

  it("keeps the generator's alerts and the plan order", () => {
    const out = applyRepoSignals(data, everyRepo({ hasAuditCriteria: false }), NOW);
    expect(out.plans.map((p) => p.slug)).toEqual(data.plans.map((p) => p.slug));
    for (const [i, p] of out.plans.entries()) for (const a of data.plans[i].alerts) expect(p.alerts).toContainEqual(a);
  });
});
