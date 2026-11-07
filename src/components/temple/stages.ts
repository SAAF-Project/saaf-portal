import * as THREE from "three";
import type { PlanRecord } from "./types";

/**
 * Maturity stage of a plan. The generator decides it (tools/scripts/generate_dashboard.py): what the PDCA table
 * claims, held back where it has to be shown. The stage names are the same for every kind of plan. Each stage has
 * one colour, running from red (just a draft) to green (improving). Soft tones, so the temple stays calm.
 */
export interface Stage {
  id: number; // 0 = least mature
  key: string;
  label: string;
  hint: string;
  color: string;
}

export const STAGES: Stage[] = [
  { id: 0, key: "draft-plan", label: "Draft plan", hint: "The plan is not complete yet, or it has no PDCA table", color: "#e27d86" },
  { id: 1, key: "final-plan", label: "Final plan", hint: "The plan is complete; nothing is built yet", color: "#eda26e" },
  { id: 2, key: "building", label: "Building", hint: "Work has started (PDCA: Do in progress)", color: "#efd070" },
  { id: 3, key: "ready", label: "Ready", hint: "Do is complete; not tested yet", color: "#bcd879" },
  { id: 4, key: "tested", label: "Tested", hint: "Check has started or is done", color: "#80cf93" },
  { id: 5, key: "improving", label: "Improving", hint: "Act has started or is done", color: "#4fb887" },
];

/** The stage of a plan, as decided by the generator. */
export function stageOf(plan: Pick<PlanRecord, "stage">): Stage {
  return STAGES[plan.stage] ?? STAGES[0];
}

/** Least mature first, then by PDCA progress, then by name: the order plans are laid out (bottom / left first), so green ends up on top. */
export function byMaturity(a: PlanRecord, b: PlanRecord): number {
  return a.stage - b.stage || a.progress - b.progress || a.slug.localeCompare(b.slug);
}

export interface StageCount {
  stage: Stage;
  count: number;
}

/** Plans per stage, least mature first (red to green), empty stages left out. */
export function stageCounts(plans: PlanRecord[]): StageCount[] {
  const counts = new Map<number, StageCount>();
  for (const plan of plans) {
    const stage = stageOf(plan);
    const entry = counts.get(stage.id) ?? { stage, count: 0 };
    entry.count += 1;
    counts.set(stage.id, entry);
  }
  return [...counts.values()].sort((a, b) => a.stage.id - b.stage.id);
}

/** Where each segment starts, as a number of plans from the bottom (or left) of the part. */
export function segmentStarts(segments: { count: number }[]): number[] {
  return segments.map((_, i) => segments.slice(0, i).reduce((sum, seg) => sum + seg.count, 0));
}

export interface StageSegment {
  stage: Stage;
  count: number;
  ghost: boolean; // plans that do not match the active filters: drawn faded, in place
}

/**
 * The bands of a collapsed part: per stage (red to green) first the plans that match the filters, then those that
 * do not (ghost). Without filters every plan matches, so this is exactly stageCounts().
 */
export function stageSegments(plans: PlanRecord[], matches: (plan: PlanRecord) => boolean): StageSegment[] {
  const out: StageSegment[] = [];
  for (const { stage } of stageCounts(plans)) {
    const inStage = plans.filter((p) => stageOf(p).id === stage.id);
    const hit = inStage.filter(matches).length;
    if (hit) out.push({ stage, count: hit, ghost: false });
    if (inStage.length - hit) out.push({ stage, count: inStage.length - hit, ghost: true });
  }
  return out;
}

const RAMP = STAGES.map((s) => new THREE.Color(s.color));

/** Continuous red -> green colour for a 0..1 value (progress bars). */
export function progressColor(value: number | null): THREE.Color {
  if (value === null) return new THREE.Color("#8b94a5");
  const x = Math.min(1, Math.max(0, value)) * (RAMP.length - 1);
  const i = Math.min(RAMP.length - 2, Math.floor(x));
  return RAMP[i].clone().lerp(RAMP[i + 1], x - i);
}
