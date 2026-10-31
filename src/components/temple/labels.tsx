import { useMemo, useRef, type MutableRefObject, type ReactNode } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { ANNEX_D, PILLAR_D, type Layout } from "./layout";
import { KIND_LABEL } from "./glyphs";
import { stageOf } from "./stages";
import type { Focus, PlanRecord, ProgressData } from "./types";

type V3 = [number, number, number];

export type LabelAnchor = "center" | "top" | "bottom" | "left";
const ANCHOR_TRANSFORM: Record<LabelAnchor, string> = {
  center: "translate(-50%, -50%)",
  top: "translate(-50%, 0)",
  bottom: "translate(-50%, -100%)",
  left: "translate(0, -50%)",
};

export interface LabelSpec {
  id: string;
  pos: V3;
  node: ReactNode;
  anchor?: LabelAnchor; // which point of the label sits on `pos` (default: top-centre for part labels)
}

const pct = (v: number | null) => `${Math.round((v ?? 0) * 100)}%`;

/** Everything that is written into the 3D scene, derived from the data. Plain DOM, positioned each frame. */
export function buildLabels(data: ProgressData, layout: Layout, focus: Focus, hover: string | null, matches: (plan: PlanRecord) => boolean, filtersActive: boolean): LabelSpec[] {
  const specs: LabelSpec[] = [];
  const plansBySlug = new Map(data.plans.map((p) => [p.slug, p]));
  // the part that is opened up shows its plans instead of a card
  const expanded = focus.level === "part" ? focus.partId : focus.level === "plan" ? plansBySlug.get(focus.slug)?.part : focus.level === "annex" ? "annex" : undefined;
  const part = (id: string) => data.parts.find((p) => p.id === id);
  const hits = (id: string) => (part(id)?.plans ?? []).filter((slug) => { const plan = plansBySlug.get(slug); return plan && matches(plan); }).length;
  const card = (id: string, name: string, pos: V3, sub?: string, wide = false) => {
    const p = part(id);
    // the opened part shows its plans instead of a card; the foundation view fades everything else, so no cards there
    if (!p || expanded === id || expanded === "foundation" || !p.plan_count) return;
    specs.push({
      id: `part-${id}`,
      anchor: "center",
      pos,
      node: (
        <div className={wide ? "part-label wide" : "part-label"}>
          <b>{name}</b>
          {filtersActive ? (
            <>
              <span className="pct">{hits(id)} of {p.plan_count}</span>
              <span>match the filters</span>
            </>
          ) : (
            <>
              <span className="pct">{pct(p.progress)}</span>
              <span>{sub ?? `${p.plan_count} plans`}</span>
            </>
          )}
        </div>
      ),
    });
  };

  // cards sit on the parts themselves
  data.parts
    .filter((p) => p.kind === "pillar")
    .forEach((p) => card(p.id, p.stage ?? p.name, [layout.pillarX[p.id], layout.pillarBaseY + (layout.pillarTopY - layout.pillarBaseY) * 0.72, PILLAR_D / 2 + 0.05]));
  const foundation = part("foundation");
  if (foundation) card("foundation", "Foundation", [0, 0.64, layout.frontZ - 1.2], `${foundation.name} · ${foundation.plan_count} plans`, true);
  const roof = layout.bodies["governance"];
  if (roof?.type === "roof") card("governance", part("governance")?.name ?? "Roof", [0, roof.baseY + roof.beamH + roof.triH * 0.3, roof.depth / 2 + 0.05], undefined, true);
  card("annex", "Repo Annex", [layout.annexX, 2.6, ANNEX_D / 2 + 0.05], undefined);

  if (focus.level === "project") {
    specs.push({
      id: "banner",
      anchor: "bottom",
      pos: [0, layout.topY + 0.7, 0],
      node: (
        <div className="banner">
          <span className="banner-title">THE SAAF TEMPLE</span>
          {filtersActive ? (
            <>
              <span className="banner-pct">{data.plans.filter(matches).length} of {data.project.plan_count}</span>
              <span className="banner-sub">plans match the filters</span>
            </>
          ) : (
            <>
              <span className="banner-pct">{pct(data.project.progress)}</span>
              <span className="banner-sub">{data.project.plan_count} plans</span>
            </>
          )}
        </div>
      ),
    });
  }

  const cellsOf = expanded === "annex" ? layout.annexCells : layout.cells;

  if (hover?.startsWith("part:")) {
    const p = part(hover.slice(5));
    const box = p && layout.partBox[p.id];
    if (p && box) {
      specs.push({
        id: "tooltip",
        anchor: "bottom",
        pos: [box.center[0], box.center[1] + box.size[1] / 2 + 0.3, box.center[2]],
        node: (
          <div className="tooltip">
            <b>{p.stage ?? p.name}</b>
            <span>{pct(p.progress)} · click to open its {p.plan_count} plans</span>
          </div>
        ),
      });
    }
  } else if (hover) {
    const plan = plansBySlug.get(hover);
    const cell = cellsOf[hover] ?? layout.cells[hover];
    if (plan && cell) {
      const stage = stageOf(plan);
      specs.push({
        id: "tooltip",
        anchor: "bottom",
        pos: [cell.pos[0], cell.pos[1] + cell.size[1] / 2 + 0.3, cell.pos[2]],
        node: (
          <div className="tooltip">
            <b>{plan.title || plan.slug}</b>
            <span><i className="stage-dot" style={{ background: stage.color }} />{stage.label} · {KIND_LABEL[plan.kind].toLowerCase()} · {pct(plan.progress)}{plan.alerts.filter((a) => a.severity !== "info").length ? ` · ${plan.alerts.filter((a) => a.severity !== "info").length} alert(s)` : ""}</span>
          </div>
        ),
      });
    }
  }
  return specs;
}

/** Projects each label anchor to the screen every frame and moves its DOM element. Runs inside the canvas. */
export function LabelProjector({ specs, elements }: { specs: LabelSpec[]; elements: MutableRefObject<Map<string, HTMLDivElement>> }) {
  const v = useMemo(() => new THREE.Vector3(), []);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const last = useRef(new Map<string, string>());

  useFrame(() => {
    for (const spec of specs) {
      const el = elements.current.get(spec.id);
      if (!el) continue;
      v.set(...spec.pos).project(camera);
      const visible = v.z < 1 && Math.abs(v.x) < 1.05 && Math.abs(v.y) < 1.05;
      const t = visible
        ? `translate(${((v.x * 0.5 + 0.5) * size.width).toFixed(1)}px, ${((-v.y * 0.5 + 0.5) * size.height).toFixed(1)}px) ${ANCHOR_TRANSFORM[spec.anchor ?? "center"]}`
        : "none";
      if (last.current.get(spec.id) !== t) {
        el.style.transform = t;
        el.style.visibility = visible ? "visible" : "hidden";
        last.current.set(spec.id, t);
      }
    }
  });
  return null;
}

/** DOM layer above the canvas that holds the label elements. */
export function LabelLayer({ specs, elements }: { specs: LabelSpec[]; elements: MutableRefObject<Map<string, HTMLDivElement>> }) {
  return (
    <div className="labels" aria-hidden="true">
      {specs.map((s) => (
        <div
          key={s.id}
          className="label-anchor"
          ref={(el) => {
            if (el) elements.current.set(s.id, el);
            else elements.current.delete(s.id);
          }}
        >
          {s.node}
        </div>
      ))}
    </div>
  );
}
