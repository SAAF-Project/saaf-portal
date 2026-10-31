import { useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { CameraControls, Line } from "@react-three/drei";
import type CameraControlsImpl from "camera-controls";
import { cameraFor, focusKey, type View } from "./camera";
import { LabelLayer, LabelProjector, buildLabels } from "./labels";
import { Outline, SketchContext } from "./Outline";
import { rayFor } from "./raycast";
import { Paving, SkyArc, useAccents, type Accents } from "./Scenery";
import { PALETTE, type Palette, type Theme } from "./colors";
import { ALERT_COLOR, hasAlert, tagSeverity } from "./alerts";
import { GLYPH_PATHS } from "./glyphs";
import { computeLayout, roofBandPolygon, type Body, type Cell, type Layout, type Poly, type RoofBody } from "./layout";
import { STAGES, segmentStarts, stageCounts, stageOf, stageSegments, type StageSegment } from "./stages";
import type { Matcher } from "./filters";
import { cornerTriangle, faceMarks, facesOf, tagCorners, tagSize, type Face } from "./tags";
import { nameTexture } from "./nameTexture";
import type { Focus, PlanRecord, ProgressData } from "./types";

type V3 = [number, number, number];

const toShape = (p: Poly) => {
  const s = new THREE.Shape();
  p.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
  s.closePath();
  return s;
};
const TRIANGLE: Poly = [[0, 0], [1, 0], [0, 1]]; // placeholder outline for hooks that need one

/** Extruded polygon, centred on z = 0. */
function useExtrude(points: Poly, depth: number) {
  return useMemo(() => {
    const g = new THREE.ExtrudeGeometry(toShape(points.length ? points : TRIANGLE), { depth, bevelEnabled: false });
    g.translate(0, 0, -depth / 2);
    return g;
  }, [points, depth]);
}

/** Solid triangle lying on a face of a piece (a corner tag), in the face's own plane. */
function TagTriangle({ points, color }: { points: Poly; color: string }) {
  const geometry = useMemo(() => new THREE.ShapeGeometry(toShape(points)), [points]);
  return (
    <mesh geometry={geometry}>
      <meshBasicMaterial color={color} side={THREE.DoubleSide} polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-2} toneMapped={false} />
    </mesh>
  );
}

// One texture per kind: its symbol in dark ink, soft enough to sit on every stage colour.
const glyphTextures = new Map<string, THREE.CanvasTexture>();
function glyphTexture(kind: string): THREE.CanvasTexture | null {
  const path = GLYPH_PATHS[kind as keyof typeof GLYPH_PATHS];
  if (!path) return null;
  const cached = glyphTextures.get(kind);
  if (cached) return cached;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(128 / 24, 128 / 24);
  ctx.fillStyle = "rgba(20, 28, 50, 0.6)";
  ctx.fill(new Path2D(path), "evenodd");
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  glyphTextures.set(kind, texture);
  return texture;
}

/**
 * Marks on one face of a piece: the alert tag at the left corner (violet = conflict, indigo = warning), a light tag at
 * the right corner when its track is only a proposal, the plan's name in the largest free spot, and the symbol of its
 * kind (agent, workflow, skill, document) as an icon beside the name, or large in the middle when no name fits. The
 * piece itself keeps its pure stage colour.
 */
function FaceTags({ plan, face, palette, outline }: { plan: PlanRecord; face: Face; palette: Palette; outline: boolean }) {
  const quaternion = useMemo(() => new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(...face.ex), new THREE.Vector3(...face.ey), new THREE.Vector3(...face.ez))), [face]);
  const tags = useMemo(() => {
    const { left, right } = tagCorners(face.points, face.corner);
    const size = tagSize(face.points);
    return { alert: cornerTriangle(face.points, left, size), proposed: cornerTriangle(face.points, right, size), outline: [...face.points, face.points[0]].map(([x, y]) => [x, y, 0.004] as V3) };
  }, [face]);
  const severity = tagSeverity(plan);
  const proposed = hasAlert(plan, "proposed-track");
  const glyph = useMemo(() => glyphTexture(plan.kind), [plan.kind]);
  const title = plan.title || plan.slug;
  const marks = useMemo(() => faceMarks(face, { glyph: !!glyph, tags: { left: !!severity, right: proposed }, chars: title.length }), [face, glyph, severity, proposed, title]);
  const name = useMemo(() => marks.name && { ...marks.name, texture: nameTexture(title, marks.name.w, marks.name.h) }, [marks, title]);
  return (
    <group position={face.position} quaternion={quaternion}>
      {outline && <Line points={tags.outline} color="#ffffff" lineWidth={4} />}
      {severity && <TagTriangle points={tags.alert} color={ALERT_COLOR[severity]} />}
      {proposed && <TagTriangle points={tags.proposed} color={palette.ink} />}
      {glyph && marks.glyph && (
        <mesh position={[marks.glyph.x, marks.glyph.y, 0.002]} raycast={() => null}>
          <planeGeometry args={[marks.glyph.size, marks.glyph.size]} />
          <meshBasicMaterial map={glyph} transparent depthWrite={false} side={THREE.DoubleSide} toneMapped={false} polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1} />
        </mesh>
      )}
      {name && (
        <mesh position={[name.cx, name.cy, 0.002]} raycast={() => null}>
          <planeGeometry args={[name.w, name.h]} />
          <meshBasicMaterial map={name.texture} transparent depthWrite={false} side={THREE.DoubleSide} toneMapped={false} polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1} />
        </mesh>
      )}
    </group>
  );
}

interface CellProps {
  plan: PlanRecord;
  cell: Cell;
  palette: Palette;
  selected: boolean;
  dim: boolean; // does not match the active filters: faded, no tags
  hovered: boolean;
  onPick: (slug: string) => void;
  onHover: (id: string | null) => void;
}

/**
 * One plan as a piece of its part, in the single colour of its stage. Opens from a seamless shape into
 * separate pieces. The selected plan keeps its colour, is pulled forward and gets a white outline.
 */
function PlanCell({ plan, cell, palette, selected, dim, hovered, onPick, onHover }: CellProps) {
  const color = stageOf(plan).color;
  const group = useRef<THREE.Group>(null);
  const open = useRef(0);
  const polyGeometry = useExtrude(cell.geom.type === "poly" ? cell.geom.points : [], cell.geom.type === "poly" ? cell.geom.depth : 1);
  const lift: V3 = cell.partId === "foundation" ? [0, 0.3, 0] : [0, 0, 0.4];

  useFrame((_, dt) => {
    open.current = Math.min(1, open.current + dt * 2.4);
    const e = 1 - Math.pow(1 - open.current, 3);
    group.current?.scale.setScalar(selected ? 1.02 : 1 - 0.06 * e);
  });

  const handlers = {
    onClick: (e: { stopPropagation: () => void }) => {
      e.stopPropagation();
      onPick(plan.slug);
    },
    onPointerOver: (e: { stopPropagation: () => void }) => {
      e.stopPropagation();
      onHover(plan.slug);
      document.body.style.cursor = "pointer";
    },
    onPointerOut: () => {
      onHover(null);
      document.body.style.cursor = "";
    },
  };

  return (
    <group position={cell.pos}>
      <group ref={group} position={selected ? lift : [0, 0, 0]}>
        <mesh {...handlers} geometry={cell.geom.type === "poly" ? polyGeometry : undefined}>
          {cell.geom.type === "box" && <boxGeometry args={cell.geom.size} />}
          <meshStandardMaterial key={dim ? "dim" : "solid"} color={color} emissive={color} emissiveIntensity={selected ? 0.16 : hovered ? 0.18 : 0.08} roughness={0.9} transparent={dim} opacity={dim ? 0.13 : 1} depthWrite={!dim} />
          {!dim && <Outline color={selected || hovered ? "#ffffff" : palette.edge} />}
        </mesh>
        {!dim && facesOf(cell).map((face) => (
          <FaceTags key={face.name} plan={plan} face={face} palette={palette} outline={selected && face.name === "front"} />
        ))}
      </group>
    </group>
  );
}

/** Roof slices, one per stage segment, each covering the share of the roof's surface that its plans cover. */
function RoofBands({ body, segments, material, edge, dim, noRay }: { body: RoofBody; segments: StageSegment[]; material: (color: string, ghost: boolean) => ReactElement; edge: string; dim: boolean; noRay: ReturnType<typeof rayFor> }) {
  const bands = useMemo(() => {
    const starts = segmentStarts(segments);
    return segments.map(({ stage, count, ghost }, i) => {
      const points = roofBandPolygon(body, starts[i] / body.n, (starts[i] + count) / body.n);
      const g = new THREE.ExtrudeGeometry(toShape(points), { depth: body.depth, bevelEnabled: false });
      g.translate(0, 0, -body.depth / 2);
      return { color: stage.color, geometry: g, key: `${stage.key}-${ghost}`, ghost };
    });
  }, [body, segments]);
  return (
    <group position={[0, body.baseY, 0]}>
      {bands.map((b) => (
        <mesh key={b.key} geometry={b.geometry} raycast={noRay}>
          {material(b.color, b.ghost)}
          {!dim && !b.ghost && <Outline color={edge} />}
        </mesh>
      ))}
    </group>
  );
}

interface PartBodyProps {
  body: Body;
  plans: PlanRecord[];
  matches: Matcher;
  palette: Palette;
  hovered: boolean;
  dim: boolean;
  onPick: () => void;
  onHover: (id: string | null) => void;
  partId: string;
}

/**
 * Collapsed part (first screen): one solid shape, banded by stage. Each band covers the share of the surface
 * that its plans cover; red sits lowest and green on top (left to right on the foundation).
 */
function PartBody({ body, plans, matches, palette, hovered, dim, onPick, onHover, partId }: PartBodyProps) {
  const segments = useMemo(() => stageSegments(plans, matches), [plans, matches]);
  const n = plans.length;
  const live = useRef({ hovered, onHover });
  useEffect(() => {
    live.current = { hovered, onHover };
  });
  useEffect(
    () => () => {
      // no pointer-out arrives when this body disappears under the pointer: clear the tooltip and the cursor here
      if (live.current.hovered) {
        live.current.onHover(null);
        document.body.style.cursor = "";
      }
    },
    [],
  );
  const noRay = rayFor(dim);
  // plans that do not match the filters stay in place, as faded ghosts
  const material = (color: string, ghost: boolean) => (
    <meshStandardMaterial key={`${dim}-${ghost}`} color={color} emissive={color} emissiveIntensity={hovered ? 0.18 : 0.08} roughness={0.9} transparent={dim || ghost} opacity={dim ? 0.1 : ghost ? 0.13 : 1} depthWrite={!(dim || ghost)} />
  );

  const handlers = {
    onClick: (e: { stopPropagation: () => void }) => {
      e.stopPropagation();
      onPick();
    },
    onPointerOver: (e: { stopPropagation: () => void }) => {
      e.stopPropagation();
      onHover(`part:${partId}`);
      document.body.style.cursor = "pointer";
    },
    onPointerOut: () => {
      onHover(null);
      document.body.style.cursor = "";
    },
  };

  if (!n) return null;

  if (body.type === "roof") {
    return (
      <group {...handlers}>
        <RoofBands body={body} segments={segments} material={material} edge={palette.edge} dim={dim} noRay={noRay} />
      </group>
    );
  }

  const [w, h, d] = body.size;
  const [cx, cy, cz] = body.center;
  const starts = segmentStarts(segments);
  return (
    <group {...handlers}>
      {segments.map(({ stage, count, ghost }, i) => {
        const f0 = starts[i] / n;
        const f = count / n;
        const mid = f0 + f / 2;
        const pos: V3 = body.axis === "y" ? [cx, cy - h / 2 + h * mid, cz] : [cx - w / 2 + w * mid, cy, cz];
        const size: V3 = body.axis === "y" ? [w, h * f, d] : [w * f, h, d];
        return (
          <mesh key={`${stage.key}-${ghost}`} position={pos} raycast={noRay}>
            <boxGeometry args={size} />
            {material(stage.color, ghost)}
            {!dim && !ghost && <Outline color={palette.edge} />}
          </mesh>
        );
      })}
    </group>
  );
}

interface SceneProps {
  data: ProgressData;
  layout: Layout;
  palette: Palette;
  focus: Focus;
  hover: string | null;
  matches: Matcher;
  filtersActive: boolean;
  accents: Accents;
  theme: Theme;
  onHover: (id: string | null) => void;
  onFocus: (f: Focus) => void;
}

function Scene({ data, layout, palette, focus, hover, matches, filtersActive, accents, theme, onHover, onFocus }: SceneProps) {
  const plans = useMemo(() => new Map(data.plans.map((p) => [p.slug, p])), [data]);
  const parts = useMemo(() => new Map(data.parts.map((p) => [p.id, p])), [data]);
  const partPlans = useMemo(() => {
    const m = new Map<string, PlanRecord[]>();
    for (const part of data.parts) m.set(part.id, part.plans.map((s) => plans.get(s)).filter((p): p is PlanRecord => !!p));
    return m;
  }, [data, plans]);

  // The part that is opened up into its plans (all others stay solid).
  const expanded =
    focus.level === "part" ? focus.partId : focus.level === "plan" ? plans.get(focus.slug)?.part : focus.level === "annex" ? "annex" : undefined;
  const selectedSlug = focus.level === "plan" || focus.level === "annex" ? focus.slug : undefined;
  const cells = expanded === "annex" ? layout.annexCells : layout.cells;
  const templeW = layout.maxX - layout.minX;

  return (
    <>
      <color attach="background" args={[accents.horizon ?? palette.background]} />
      <fog attach="fog" args={[accents.horizon ?? palette.background, accents.sky ? 70 : 80, accents.sky ? 230 : 170]} />
      <ambientLight intensity={2.4} />
      <directionalLight position={[10, 18, 14]} intensity={0.7} />
      <directionalLight position={[-12, 6, -8]} intensity={0.55} />

      {/* photoreal accents (static pictures) or, without them, a flat ground */}
      {accents.sky && <SkyArc texture={accents.sky} theme={theme} centreX={templeW / 4} />}
      {accents.ground ? (
        <Paving texture={accents.ground} theme={theme} centreX={templeW / 4} />
      ) : (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[templeW / 4, -0.02, 0]}>
          <planeGeometry args={[260, 150]} />
          <meshStandardMaterial color={palette.ground} roughness={1} />
        </mesh>
      )}

      {/* parts: solid body banded by stage, or opened up into its plans */}
      {Object.entries(layout.bodies).map(([id, body]) => {
        const part = parts.get(id);
        if (!part || expanded === id) return null;
        return (
          <PartBody
            key={id}
            partId={id}
            body={body}
            plans={partPlans.get(id) ?? []}
            matches={matches}
            palette={palette}
            hovered={hover === `part:${id}`}
            dim={expanded === "foundation"}
            onPick={() => onFocus(id === "annex" ? { level: "annex" } : { level: "part", partId: id })}
            onHover={onHover}
          />
        );
      })}
      {Object.values(cells).map((cell) => {
        const plan = plans.get(cell.slug);
        if (!plan || (cell.partId !== expanded && cell.partId !== "quarry")) return null;
        const selected = selectedSlug === cell.slug;
        return (
          <PlanCell
            key={`${cell.partId}:${cell.slug}`}
            plan={plan}
            cell={cell}
            palette={palette}
            selected={selected}
            dim={filtersActive && !selected && !matches(plan)}
            hovered={hover === cell.slug}
            onPick={(slug) => onFocus(cell.partId === "annex" ? { level: "annex", slug } : { level: "plan", slug })}
            onHover={onHover}
          />
        );
      })}
    </>
  );
}

interface TempleProps {
  data: ProgressData;
  theme: Theme;
  focus: Focus;
  matches: Matcher;
  filtersActive: boolean;
  sketch: boolean;
  scenery: boolean;
  assetBase: string;
  debug: boolean;
  onFocus: (f: Focus) => void;
}

const PANEL_WIDTH_PX = 392; // side panel (360) plus its margin

/** Moves the camera to the focus, framed for the current viewport. Lives inside the canvas to know its size. */
function CameraRig({ data, layout, focus, debug }: { data: ProgressData; layout: Layout; focus: Focus; debug: boolean }) {
  const controls = useRef<CameraControlsImpl>(null);
  const first = useRef(true);
  const size = useThree((s) => s.size);
  const camera = useThree((s) => s.camera);
  const key = focusKey(focus);
  // development only: lets scripts/colorcheck.mjs project scene points onto the screen
  useEffect(() => {
    if (debug) (window as unknown as { __temple?: unknown }).__temple = { camera, size, layout, data, stageCounts, STAGES };
  }, [debug, camera, size, layout, data]);
  const narrow = size.width < 800; // panel becomes a bottom sheet on small screens

  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    const kinds = new Map(data.parts.map((p) => [p.id, p.kind as string]));
    const view: View = { aspect: size.width / size.height, panelFrac: narrow ? 0 : PANEL_WIDTH_PX / size.width, fov: 40 };
    const { pos, target } = cameraFor(focus, layout, (id) => kinds.get(id), view);
    void c.setLookAt(...pos, ...target, !first.current);
    first.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, layout, size.width, size.height]);

  return <CameraControls ref={controls} makeDefault smoothTime={0.7} minDistance={2.5} maxDistance={110} maxPolarAngle={Math.PI / 2 - 0.05} />;
}

export function Temple({ data, theme, focus, matches, filtersActive, sketch, scenery, assetBase, debug, onFocus }: TempleProps) {
  const layout = useMemo(() => computeLayout(data), [data]);
  const accents = useAccents(theme, scenery, assetBase);
  const palette = PALETTE[theme];
  const [hover, setHover] = useState<string | null>(null);
  const elements = useRef(new Map<string, HTMLDivElement>());
  const specs = useMemo(() => buildLabels(data, layout, focus, hover, matches, filtersActive), [data, layout, focus, hover, matches, filtersActive]);

  const back = () => {
    if (focus.level === "plan") {
      const plan = data.plans.find((p) => p.slug === focus.slug);
      onFocus(plan ? { level: "part", partId: plan.part } : { level: "project" });
    } else if (focus.level === "annex" && focus.slug) onFocus({ level: "annex" });
    else if (focus.level !== "project") onFocus({ level: "project" });
  };

  return (
    <>
      <Canvas flat camera={{ fov: 40, position: [4, 8, 50], near: 0.1, far: 500 }} onPointerMissed={back} dpr={[1, 2]}>
        <CameraRig data={data} layout={layout} focus={focus} debug={debug} />
        <SketchContext.Provider value={sketch}>
          <Scene data={data} layout={layout} palette={palette} focus={focus} hover={hover} matches={matches} filtersActive={filtersActive} accents={accents} theme={theme} onHover={setHover} onFocus={onFocus} />
        </SketchContext.Provider>
        <LabelProjector specs={specs} elements={elements} />
      </Canvas>
      <LabelLayer specs={specs} elements={elements} />
    </>
  );
}

