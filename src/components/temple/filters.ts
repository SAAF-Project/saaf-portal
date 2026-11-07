import type { PlanKind, PlanRecord } from "./types";

/** A person who submitted plans (website/data/submitters.json). */
export interface Submitter {
  name: string;
  plans: string[];
}

/**
 * What the viewer filters on. An empty list means "no restriction" for that dimension; a plan matches when it
 * satisfies every dimension that has a selection (stage, type, alert, sector, owner).
 */
export interface Filters {
  stages: number[]; // stage ids (see stages.ts)
  kinds: PlanKind[]; // agent, workflow, skill, document, unspecified
  alerts: string[]; // alert ids, or ATTENTION for "has an error or warning alert"
  sectors: string[];
  owner: string | null; // personal view: only the plans of this person
}

/** Pseudo alert for the filter: the plan has at least one alert of severity error or warning. */
export const ATTENTION = "attention";

export const NO_FILTERS: Filters = { stages: [], kinds: [], alerts: [], sectors: [], owner: null };

export const isActive = (f: Filters): boolean =>
  f.stages.length > 0 || f.kinds.length > 0 || f.alerts.length > 0 || f.sectors.length > 0 || f.owner !== null;

export const needsAttention = (plan: PlanRecord): boolean => plan.alerts.some((a) => a.severity !== "info");

export type Matcher = (plan: PlanRecord) => boolean;

export function makeMatcher(f: Filters, owned: Set<string> | null): Matcher {
  const stages = new Set(f.stages);
  const kinds = new Set<string>(f.kinds);
  const alerts = new Set(f.alerts);
  const sectors = new Set(f.sectors);
  return (plan) =>
    (stages.size === 0 || stages.has(plan.stage)) &&
    (kinds.size === 0 || kinds.has(plan.kind)) &&
    (alerts.size === 0 || (alerts.has(ATTENTION) && needsAttention(plan)) || plan.alerts.some((a) => alerts.has(a.id))) &&
    (sectors.size === 0 || plan.sectors.some((s) => sectors.has(s))) &&
    (f.owner === null || (owned?.has(plan.slug) ?? false));
}

const normalise = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * The plans of one person: those listed under their name in the submitters list, plus plans they claimed
 * (the claim must contain every part of their name, so "Frank Lubbers" does not pick up every "Frank").
 */
export function ownedBy(name: string, plans: PlanRecord[], submitters: Submitter[]): Set<string> {
  const owned = new Set<string>();
  const wanted = normalise(name);
  for (const s of submitters) if (normalise(s.name) === wanted) s.plans.forEach((p) => owned.add(p));
  const parts = name.split(/\s+/).map((p) => p.toLowerCase()).filter((p) => p.length > 2);
  if (parts.length >= 2) {
    for (const p of plans) {
      const claim = p.claimed_by.toLowerCase();
      if (claim && parts.every((part) => claim.includes(part))) owned.add(p.slug);
    }
  }
  return owned;
}

/** Filters as a query string, for links: stage=2,3&type=agent&alert=attention&sector=Banking&me=Name */
export function serializeFilters(f: Filters): string {
  const q: string[] = [];
  if (f.stages.length) q.push(`stage=${f.stages.join(",")}`);
  if (f.kinds.length) q.push(`type=${f.kinds.join(",")}`);
  if (f.alerts.length) q.push(`alert=${f.alerts.join(",")}`);
  if (f.sectors.length) q.push(`sector=${f.sectors.map(encodeURIComponent).join(",")}`);
  if (f.owner) q.push(`me=${encodeURIComponent(f.owner)}`);
  return q.join("&");
}

const KINDS: PlanKind[] = ["agent", "workflow", "skill", "document", "unspecified"];

export function parseFilters(query: string): Filters {
  const params = new URLSearchParams(query);
  const list = (key: string) => (params.get(key) ?? "").split(",").filter(Boolean);
  return {
    stages: list("stage").map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= 5),
    kinds: list("type").filter((k): k is PlanKind => (KINDS as string[]).includes(k)),
    alerts: list("alert").filter((a) => /^[a-z][a-z-]*$/.test(a)),
    sectors: list("sector"),
    owner: params.get("me") || null,
  };
}

/** Toggle a value in a list (used by the filter chips). */
export function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}
