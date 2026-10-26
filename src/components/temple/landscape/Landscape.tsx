import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import * as THREE from "three";
import { Canvas, useThree } from "@react-three/fiber";
import { CameraControls, Line } from "@react-three/drei";
import type CameraControlsImpl from "camera-controls";
import type { View } from "../camera";
import { focusKey } from "../camera";
import { LabelLayer, LabelProjector, type LabelSpec } from "../labels";
import { Outline, SketchContext } from "../Outline";
import { KIND_LABEL } from "../glyphs";
import { hash } from "../sketch";
import { stageOf } from "../stages";
import type { VisualProps } from "../views";
import type { Focus, PartRecord, PlanRecord, ProgressData } from "../types";
import { landscapeCameraFor } from "./camera";
import { ISLAND_TOP, SEA_LEVEL, computeLandscape, needsSimplerObjects, pointInPolygon, type Island, type LandscapeLayout, type XZ } from "./layout";
import { PlanObject } from "./objects";
import { PALETTE, type Palette } from "./palette";

type V3 = [number, number, number];

const PANEL_WIDTH_PX = 392; // side panel (360) plus its margin
const pct = (v: number | null) => `${Math.round((v ?? 0) * 100)}%`;

// ---- sea ---------------------------------------------------------------------------------------------------------

/** Sea with a faint blueprint grid and hand-drawn wave strokes (never over an island). */
function Sea({ layout, palette }: { layout: LandscapeLayout; palette: Palette }) {
  const lines = useMemo(() => {
    const { bounds } = layout;
    const pad = 22;
    const [x0, x1, z0, z1] = [bounds.minX - pad, bounds.maxX + pad, bounds.minZ - pad, bounds.maxZ + pad];
    const grid: number[] = [];
    const step = 5;
    for (let x = Math.ceil(x0 / step) * step; x <= x1; x += step) grid.push(x, 0, z0, x, 0, z1);
    for (let z = Math.ceil(z0 / step) * step; z <= z1; z += step) grid.push(x0, 0, z, x1, 0, z);
    const shores = Object.values(layout.islands).map((i) => i.outline.map(([x, z]) => [i.center[0] + (x - i.center[0]) * 1.12, i.center[1] + (z - i.center[1]) * 1.12] as XZ));
    const waves: number[] = [];
    for (let i = 0; i < 420; i++) {
      const p: XZ = [x0 + (x1 - x0) * hash(i * 3 + 1), z0 + (z1 - z0) * hash(i * 3 + 2)];
      if (shores.some((s) => pointInPolygon(p, s))) continue;
      const len = 0.7 + 0.8 * hash(i * 3 + 3);
      // a little arc made of three strokes
      const pts: V3[] = [-1, -0.33, 0.33, 1].map((t) => [p[0] + t * len, 0, p[1] + 0.18 * (1 - t * t) * (i % 2 ? 1 : -1)]);
      for (let k = 0; k < 3; k++) waves.push(...pts[k], ...pts[k + 1]);
    }
    return { grid: new Float32Array(grid), waves: new Float32Array(waves), center: [(x0 + x1) / 2, (z0 + z1) / 2] as XZ, size: [x1 - x0 + 120, z1 - z0 + 120] as XZ };
  }, [layout]);
  return (
    <group position={[0, SEA_LEVEL - 0.3, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[lines.center[0], -0.02, lines.center[1]]}>
        <planeGeometry args={lines.size} />
        <meshBasicMaterial color={palette.sea} toneMapped={false} />
      </mesh>
      <lineSegments raycast={() => null}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[lines.grid, 3]} />
        </bufferGeometry>
        <lineBasicMaterial color={palette.seaLine} transparent opacity={0.16} toneMapped={false} />
      </lineSegments>
      <lineSegments raycast={() => null}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[lines.waves, 3]} />
        </bufferGeometry>
        <lineBasicMaterial color={palette.seaLine} transparent opacity={0.55} toneMapped={false} />
      </lineSegments>
    </group>
  );
}

// ---- scenery -----------------------------------------------------------------------------------------------------

function Tree({ position, palette }: { position: V3; palette: Palette }) {
  return (
    <group position={position} raycast={() => null}>
      <mesh position={[0, 0.14, 0]} raycast={() => null}>
        <cylinderGeometry args={[0.06, 0.08, 0.28, 6]} />
        <meshStandardMaterial color={palette.trunk} roughness={1} />
      </mesh>
      <mesh position={[0, 0.7, 0]} raycast={() => null}>
        <coneGeometry args={[0.36, 0.9, 7]} />
        <meshStandardMaterial color={palette.leaf} roughness={1} />
        <Outline color={palette.edge} threshold={30} />
      </mesh>
    </group>
  );
}

function Boat({ position, heading, palette }: { position: XZ; heading: number; palette: Palette }) {
  const sail = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(0, 0).lineTo(0.6, 0).lineTo(0, 1.1).closePath();
    return new THREE.ShapeGeometry(s);
  }, []);
  return (
    <group position={[position[0], SEA_LEVEL - 0.18, position[1]]} rotation={[0, heading, 0]} raycast={() => null}>
      <mesh position={[0, 0.08, 0]} raycast={() => null}>
        <boxGeometry args={[1.1, 0.2, 0.38]} />
        <meshStandardMaterial color={palette.stone} roughness={1} />
        <Outline color={palette.edge} threshold={30} />
      </mesh>
      <mesh geometry={sail} position={[-0.1, 0.18, 0]} raycast={() => null}>
        <meshBasicMaterial color="#ffffff" side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
    </group>
  );
}

/** The temple of governance: a small columned building, drawn in stone. */
function GovernanceBuilding({ at, palette }: { at: XZ; palette: Palette }) {
  const roof = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(-1.75, 0).lineTo(1.75, 0).lineTo(0, 0.75).closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: 1.8, bevelEnabled: false });
    g.translate(0, 0, -0.9);
    return g;
  }, []);
  const stone = (children: ReactNode, position: V3, args: V3) => (
    <mesh position={position} raycast={() => null}>
      {children ?? <boxGeometry args={args} />}
      <meshStandardMaterial color={palette.stone} roughness={1} />
      <Outline color={palette.edge} threshold={30} />
    </mesh>
  );
  return (
    <group position={[at[0], ISLAND_TOP, at[1]]}>
      {stone(null, [0, 0.1, 0], [3.8, 0.2, 2.2])}
      {[-1.35, -0.45, 0.45, 1.35].map((x) => (
        <mesh key={x} position={[x, 0.75, 0.7]} raycast={() => null}>
          <cylinderGeometry args={[0.13, 0.13, 1.1, 8]} />
          <meshStandardMaterial color={palette.stone} roughness={1} />
          <Outline color={palette.edge} threshold={30} />
        </mesh>
      ))}
      {stone(null, [0, 1.38, 0], [3.5, 0.16, 1.9])}
      <mesh geometry={roof} position={[0, 1.46, 0]} raycast={() => null}>
        <meshStandardMaterial color={palette.stone} roughness={1} />
        <Outline color={palette.edge} threshold={30} />
      </mesh>
    </group>
  );
}

/** The hub of the shared infrastructure: a round building with a blue cube on top. */
function InfrastructureHub({ at, palette }: { at: XZ; palette: Palette }) {
  return (
    <group position={[at[0], ISLAND_TOP, at[1]]}>
      <mesh position={[0, 0.45, 0]} raycast={() => null}>
        <cylinderGeometry args={[1.5, 1.7, 0.9, 20]} />
        <meshStandardMaterial color={palette.stone} roughness={1} />
        <Outline color={palette.edge} threshold={30} />
      </mesh>
      <mesh position={[0, 1.5, 0]} rotation={[0, Math.PI / 4, 0]} raycast={() => null}>
        <boxGeometry args={[0.95, 0.95, 0.95]} />
        <meshStandardMaterial color="#5fb4ee" emissive="#5fb4ee" emissiveIntensity={0.35} roughness={0.6} />
        <Outline color={palette.edge} threshold={30} />
      </mesh>
    </group>
  );
}

// ---- islands -----------------------------------------------------------------------------------------------------

function toShape(outline: XZ[]) {
  const s = new THREE.Shape();
  outline.forEach(([x, z], i) => (i ? s.lineTo(x, -z) : s.moveTo(x, -z))); // shape y = -world z, see the rotation below
  s.closePath();
  return s;
}

interface IslandProps {
  island: Island;
  palette: Palette;
  hovered: boolean;
  clickable: boolean;
  scenery: boolean;
  onPick: () => void;
  onHover: (on: boolean) => void;
}

function IslandBody({ island, palette, hovered, clickable, scenery, onPick, onHover }: IslandProps) {
  const depth = ISLAND_TOP - SEA_LEVEL + 1.1;
  const geometry = useMemo(() => new THREE.ExtrudeGeometry(toShape(island.outline), { depth, bevelEnabled: false, curveSegments: 1 }), [island.outline, depth]);
  const handlers = clickable
    ? {
        onClick: (e: { stopPropagation: () => void }) => {
          e.stopPropagation();
          onPick();
        },
        onPointerOver: (e: { stopPropagation: () => void }) => {
          e.stopPropagation();
          onHover(true);
          document.body.style.cursor = "pointer";
        },
        onPointerOut: () => {
          onHover(false);
          document.body.style.cursor = "";
        },
      }
    : {};
  return (
    <group>
      {/* the extrusion runs along local z; turned upright, local z becomes world y */}
      <mesh geometry={geometry} rotation={[-Math.PI / 2, 0, 0]} position={[0, SEA_LEVEL - 1.1, 0]} {...handlers}>
        <meshStandardMaterial attach="material-0" color={palette.grass} emissive={palette.grass} emissiveIntensity={hovered ? 0.22 : 0.07} roughness={1} />
        <meshStandardMaterial attach="material-1" color={palette.rock} roughness={1} />
        <Outline color={palette.edge} threshold={30} />
      </mesh>
      {scenery && island.trees.map(([x, z], i) => <Tree key={i} position={[x, ISLAND_TOP, z]} palette={palette} />)}
      {island.landmark && island.kind === "roof" && <GovernanceBuilding at={island.landmark.center} palette={palette} />}
      {island.landmark && island.kind === "foundation" && <InfrastructureHub at={island.landmark.center} palette={palette} />}
    </group>
  );
}

// ---- connections -------------------------------------------------------------------------------------------------

function Bridge({ from, to, palette }: { from: XZ; to: XZ; palette: Palette }) {
  const length = Math.abs(to[0] - from[0]);
  return (
    <mesh position={[(from[0] + to[0]) / 2, ISLAND_TOP - 0.06, from[1]]} raycast={() => null}>
      <boxGeometry args={[length, 0.1, 0.8]} />
      <meshStandardMaterial color={palette.trunk} roughness={1} />
      <Outline color={palette.edge} threshold={30} />
    </mesh>
  );
}

/** A dashed arrow through the air between two points, with an arrowhead and, optionally, an envelope in the middle. */
function Arrow({ from, to, lift, envelope, palette }: { from: V3; to: V3; lift: number; envelope: boolean; palette: Palette }) {
  const { points, head, quaternion, mid } = useMemo(() => {
    const a = new THREE.Vector3(...from);
    const b = new THREE.Vector3(...to);
    const m = a.clone().add(b).multiplyScalar(0.5);
    m.y += lift;
    const curve = new THREE.QuadraticBezierCurve3(a, m, b);
    const pts = curve.getPoints(28);
    const tangent = curve.getTangent(1).normalize();
    return { points: pts.map((p) => [p.x, p.y, p.z] as V3), head: b, quaternion: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), tangent), mid: curve.getPoint(0.5) };
  }, [from, to, lift]);
  return (
    <group raycast={() => null}>
      <Line points={points} color={palette.ink} lineWidth={1.8} dashed dashSize={0.32} gapSize={0.22} transparent opacity={0.8} raycast={() => null} />
      <mesh position={head} quaternion={quaternion} raycast={() => null}>
        <coneGeometry args={[0.16, 0.38, 8]} />
        <meshBasicMaterial color={palette.ink} toneMapped={false} />
      </mesh>
      {envelope && (
        <mesh position={mid} raycast={() => null}>
          <boxGeometry args={[0.6, 0.4, 0.05]} />
          <meshStandardMaterial color="#ffffff" roughness={1} />
          <Outline color={palette.edge} threshold={30} />
        </mesh>
      )}
    </group>
  );
}

// ---- labels ------------------------------------------------------------------------------------------------------

function buildLandscapeLabels(data: ProgressData, layout: LandscapeLayout, focus: Focus, hover: string | null, matches: (p: PlanRecord) => boolean, filtersActive: boolean): LabelSpec[] {
  const specs: LabelSpec[] = [];
  const plans = new Map(data.plans.map((p) => [p.slug, p]));
  const expanded = focus.level === "part" ? focus.partId : focus.level === "plan" ? plans.get(focus.slug)?.part : focus.level === "annex" ? "annex" : undefined;
  const part = (id: string): PartRecord | undefined => data.parts.find((p) => p.id === id);
  const hits = (p: PartRecord) => p.plans.filter((s) => { const plan = plans.get(s); return plan && matches(plan); }).length;

  // a card on every island that is not opened
  for (const island of Object.values(layout.islands)) {
    const p = part(island.id);
    if (!p || !p.plan_count || expanded === island.id) continue;
    const wide = island.rx > 8;
    specs.push({
      id: `part-${island.id}`,
      anchor: "top",
      pos: [island.center[0], SEA_LEVEL, island.center[1] + island.rz * 1.08],
      node: (
        <div className={wide ? "part-label wide" : "part-label"}>
          <b>{p.stage ?? p.name}</b>
          {filtersActive ? (
            <>
              <span className="pct">{hits(p)} of {p.plan_count}</span>
              <span>match the filters</span>
            </>
          ) : (
            <>
              <span className="pct">{pct(p.progress)}</span>
              <span>{p.plan_count} plans</span>
            </>
          )}
        </div>
      ),
    });
  }

  if (focus.level === "project") {
    const gov = layout.islands.governance;
    specs.push({
      id: "banner",
      anchor: "bottom",
      pos: [0, ISLAND_TOP + 4.2, gov ? gov.center[1] - gov.rz * 0.6 : layout.bounds.minZ],
      node: (
        <div className="banner">
          <span className="banner-title">THE SAAF ARCHIPELAGO</span>
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

  // names are not written on the objects: the tooltip shows a name while the pointer is on an object. The selected
  // plan is the exception: it keeps a card with its name, so you can see which one you are looking at.
  const selectedSlug = focus.level === "plan" || focus.level === "annex" ? focus.slug : undefined;
  const selectedPlan = selectedSlug ? plans.get(selectedSlug) : undefined;
  const selectedIsland = focus.level === "annex" ? "annex" : selectedPlan?.part;
  const selectedSlot = selectedIsland && selectedSlug ? layout.islands[selectedIsland]?.slots.find((sl) => sl.slug === selectedSlug) : undefined;
  if (selectedPlan && selectedSlot) {
    const stage = stageOf(selectedPlan);
    specs.push({
      id: "selected-card",
      anchor: "top",
      pos: [selectedSlot.pos[0], ISLAND_TOP - 0.02, selectedSlot.pos[1] + 0.7],
      node: (
        <div className="plate on">
          <b>{selectedPlan.title || selectedPlan.slug}</b>
          <span><i className="stage-dot" style={{ background: stage.color }} />{stage.label} · {KIND_LABEL[selectedPlan.kind].toLowerCase()}</span>
        </div>
      ),
    });
  }

  if (hover?.startsWith("part:")) {
    const island = layout.islands[hover.slice(5)];
    const p = island && part(island.id);
    if (island && p) {
      specs.push({
        id: "tooltip",
        anchor: "bottom",
        pos: [island.center[0], ISLAND_TOP + 1.6, island.center[1]],
        node: (
          <div className="tooltip">
            <b>{p.stage ?? p.name}</b>
            <span>{pct(p.progress)} · click to open its {p.plan_count} plans</span>
          </div>
        ),
      });
    }
  } else if (hover) {
    const [islandId, slug] = hover.split(":");
    const slot = layout.islands[islandId]?.slots.find((s) => s.slug === slug);
    const plan = plans.get(slug);
    if (slot && plan && !(selectedSlot && slug === selectedSlug && islandId === selectedIsland)) {
      const stage = stageOf(plan);
      const open = plan.alerts.filter((a) => a.severity !== "info").length;
      specs.push({
        id: "tooltip",
        anchor: "bottom",
        pos: [slot.pos[0], ISLAND_TOP + 1.6, slot.pos[1]],
        node: (
          <div className="tooltip">
            <b>{plan.title || plan.slug}</b>
            <span><i className="stage-dot" style={{ background: stage.color }} />{stage.label} · {KIND_LABEL[plan.kind].toLowerCase()} · {pct(plan.progress)}{open ? ` · ${open} alert(s)` : ""}</span>
          </div>
        ),
      });
    }
  }
  return specs;
}

// ---- camera ------------------------------------------------------------------------------------------------------

function CameraRig({ data, layout, focus, debug }: { data: ProgressData; layout: LandscapeLayout; focus: Focus; debug: boolean }) {
  const controls = useRef<CameraControlsImpl>(null);
  const first = useRef(true);
  const size = useThree((s) => s.size);
  const camera = useThree((s) => s.camera);
  const key = focusKey(focus);
  useEffect(() => {
    if (debug) (window as unknown as { __landscape?: unknown }).__landscape = { camera, size, layout, data };
  }, [debug, camera, size, layout, data]);
  const narrow = size.width < 800;

  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    const plans = new Map(data.plans.map((p) => [p.slug, p]));
    const view: View = { aspect: size.width / size.height, panelFrac: narrow ? 0 : PANEL_WIDTH_PX / size.width, fov: 40 };
    const { pos, target } = landscapeCameraFor(focus, layout, (slug) => plans.get(slug), view);
    void c.setLookAt(...pos, ...target, !first.current);
    first.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, layout, size.width, size.height]);

  return <CameraControls ref={controls} makeDefault smoothTime={0.7} minDistance={2.5} maxDistance={140} maxPolarAngle={Math.PI / 2 - 0.08} />;
}

// ---- scene -------------------------------------------------------------------------------------------------------

export function Landscape({ data, theme, focus, matches, filtersActive, sketch, scenery, debug, onFocus }: VisualProps) {
  const layout = useMemo(() => computeLandscape(data), [data]);
  const palette = PALETTE[theme];
  const [hover, setHover] = useState<string | null>(null);
  const elements = useRef(new Map<string, HTMLDivElement>());
  const plans = useMemo(() => new Map(data.plans.map((p) => [p.slug, p])), [data]);
  const specs = useMemo(() => buildLandscapeLabels(data, layout, focus, hover, matches, filtersActive), [data, layout, focus, hover, matches, filtersActive]);

  const expanded = focus.level === "part" ? focus.partId : focus.level === "plan" ? plans.get(focus.slug)?.part : focus.level === "annex" ? "annex" : undefined;
  const selectedSlug = focus.level === "plan" || focus.level === "annex" ? focus.slug : undefined;
  const simpler = needsSimplerObjects(data.plans.length);

  const back = () => {
    if (focus.level === "plan") {
      const plan = plans.get(focus.slug);
      onFocus(plan ? { level: "part", partId: plan.part } : { level: "project" });
    } else if (focus.level === "annex" && focus.slug) onFocus({ level: "annex" });
    else if (focus.level !== "project") onFocus({ level: "project" });
  };

  const openIsland = (id: string) => onFocus(id === "annex" ? { level: "annex" } : { level: "part", partId: id });

  return (
    <>
      <Canvas flat camera={{ fov: 40, position: [0, 30, 50], near: 0.1, far: 600 }} onPointerMissed={back} dpr={[1, 2]}>
        <CameraRig data={data} layout={layout} focus={focus} debug={debug} />
        <SketchContext.Provider value={sketch}>
          <color attach="background" args={[palette.sea]} />
          <fog attach="fog" args={[palette.sea, 90, 260]} />
          <ambientLight intensity={2.4} />
          <directionalLight position={[10, 18, 14]} intensity={0.7} />
          <directionalLight position={[-12, 6, -8]} intensity={0.55} />

          <Sea layout={layout} palette={palette} />
          {layout.bridges.map((b, i) => <Bridge key={i} from={b.from} to={b.to} palette={palette} />)}
          {layout.flows.map(([a, b]) => {
            const [ia, ib] = [layout.islands[a], layout.islands[b]];
            return <Arrow key={`${a}-${b}`} from={[ia.center[0] + ia.rx * 0.5, ISLAND_TOP + 1.5, ia.center[1]]} to={[ib.center[0] - ib.rx * 0.5, ISLAND_TOP + 1.5, ib.center[1]]} lift={2.6} envelope palette={palette} />;
          })}
          {layout.supports.map((id) => {
            const [phase, base] = [layout.islands[id], layout.islands.foundation];
            return <Arrow key={`support-${id}`} from={[phase.center[0], ISLAND_TOP + 0.8, base.center[1] - base.rz * 0.8]} to={[phase.center[0], ISLAND_TOP + 0.8, phase.center[1] + phase.rz * 0.92]} lift={0.5} envelope={false} palette={palette} />;
          })}
          {scenery && layout.boats.map((b, i) => <Boat key={i} position={b.pos} heading={b.heading} palette={palette} />)}

          {Object.values(layout.islands).map((island) => (
            <group key={island.id}>
              <IslandBody
                island={island}
                palette={palette}
                hovered={hover === `part:${island.id}`}
                clickable={expanded !== island.id}
                scenery={scenery}
                onPick={() => openIsland(island.id)}
                onHover={(on) => setHover(on ? `part:${island.id}` : null)}
              />
              {island.slots.map((slot) => {
                const plan = plans.get(slot.slug);
                if (!plan) return null;
                const key = `${island.id}:${slot.slug}`;
                const selected = selectedSlug === slot.slug && (island.id === "annex" ? focus.level === "annex" : focus.level === "plan" && plan.part === island.id);
                return (
                  <PlanObject
                    key={key}
                    plan={plan}
                    position={[slot.pos[0], ISLAND_TOP, slot.pos[1]]}
                    palette={palette}
                    selected={selected}
                    hovered={hover === key}
                    dim={filtersActive && !selected && !matches(plan)}
                    simple={simpler && expanded !== island.id}
                    named={expanded === island.id}
                    onPick={() => onFocus(island.id === "annex" ? { level: "annex", slug: slot.slug } : { level: "plan", slug: slot.slug })}
                    onHover={(on) => setHover(on ? key : null)}
                  />
                );
              })}
            </group>
          ))}
        </SketchContext.Provider>
        <LabelProjector specs={specs} elements={elements} />
      </Canvas>
      <LabelLayer specs={specs} elements={elements} />
    </>
  );
}
