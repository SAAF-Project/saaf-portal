import { useMemo, type ReactNode } from "react";
import * as THREE from "three";
import { Outline } from "../Outline";
import { rayFor } from "../raycast";
import { ALERT_COLOR, tagSeverity } from "../alerts";
import { nameTexture } from "../nameTexture";
import { stageOf } from "../stages";
import type { PlanKind, PlanRecord } from "../types";
import type { Palette } from "./palette";

/**
 * The things that stand on the islands. A plan is a small object whose body is its stage colour; the shape says what
 * kind of plan it is: a robot (agent), a ring (workflow), a gem (skill), a page (document). All are about one unit
 * tall and stand on y = 0 of their group, so the layout only has to place the group.
 */

type V3 = [number, number, number];

const INK = "#1b2230";
const tint = (color: string, toward: string, amount: number) => new THREE.Color(color).lerp(new THREE.Color(toward), amount).getStyle();

interface PartProps {
  position?: V3;
  rotation?: V3;
  color: string;
  dim: boolean;
  outline?: string | null; // pen colour, or null for no outline
  children: ReactNode;
}

/** One solid piece: a mesh with a flat soft material and, optionally, a pen outline. */
function Piece({ position, rotation, color, dim, outline, children }: PartProps) {
  return (
    <mesh position={position} rotation={rotation} raycast={rayFor(dim)}>
      {children}
      <meshStandardMaterial key={String(dim)} color={color} emissive={color} emissiveIntensity={0.07} roughness={0.9} transparent={dim} opacity={dim ? 0.16 : 1} depthWrite={!dim} />
      {outline && !dim && <Outline color={outline} threshold={30} />}
    </mesh>
  );
}

interface ObjectProps {
  color: string;
  dim: boolean;
  pen: string;
  name?: string; // written on the object where it has room for it (the robot's shirt)
}

// the front of the robot's body: room for its name, a little in from the edges
const SHIRT_W = 0.5;
const SHIRT_H = 0.4;

/** The plan's name on the robot's shirt: as large as fits on four lines, cut off with "…" below a readable size. */
function Shirt({ name }: { name: string }) {
  const texture = useMemo(() => nameTexture(name, SHIRT_W, SHIRT_H, { maxLines: 4, minFont: 0.075 }), [name]);
  return (
    <mesh position={[0, 0.41, 0.182]} raycast={() => null}>
      <planeGeometry args={[SHIRT_W, SHIRT_H]} />
      <meshBasicMaterial map={texture} transparent depthWrite={false} toneMapped={false} />
    </mesh>
  );
}

function Robot({ color, dim, pen, name }: ObjectProps) {
  const head = tint(color, "#ffffff", 0.28);
  const limb = tint(color, "#000000", 0.12);
  return (
    <>
      <Piece position={[-0.14, 0.09, 0]} color={limb} dim={dim}><boxGeometry args={[0.14, 0.18, 0.14]} /></Piece>
      <Piece position={[0.14, 0.09, 0]} color={limb} dim={dim}><boxGeometry args={[0.14, 0.18, 0.14]} /></Piece>
      <Piece position={[0, 0.41, 0]} color={color} dim={dim} outline={pen}><boxGeometry args={[0.56, 0.46, 0.36]} /></Piece>
      {name && !dim && <Shirt name={name} />}
      <Piece position={[-0.37, 0.43, 0]} color={limb} dim={dim}><boxGeometry args={[0.1, 0.34, 0.12]} /></Piece>
      <Piece position={[0.37, 0.43, 0]} color={limb} dim={dim}><boxGeometry args={[0.1, 0.34, 0.12]} /></Piece>
      <Piece position={[0, 0.85, 0]} color={head} dim={dim} outline={pen}><boxGeometry args={[0.5, 0.36, 0.36]} /></Piece>
      <Piece position={[-0.12, 0.87, 0.185]} color={INK} dim={dim}><boxGeometry args={[0.09, 0.09, 0.02]} /></Piece>
      <Piece position={[0.12, 0.87, 0.185]} color={INK} dim={dim}><boxGeometry args={[0.09, 0.09, 0.02]} /></Piece>
      <Piece position={[0, 1.11, 0]} color={pen} dim={dim}><cylinderGeometry args={[0.018, 0.018, 0.16, 6]} /></Piece>
      <Piece position={[0, 1.22, 0]} color={head} dim={dim}><sphereGeometry args={[0.06, 10, 8]} /></Piece>
    </>
  );
}

function Ring({ color, dim, pen }: ObjectProps) {
  return (
    <>
      <Piece position={[0, 0.03, 0]} color={tint(color, "#ffffff", 0.5)} dim={dim} outline={pen}><cylinderGeometry args={[0.36, 0.4, 0.06, 16]} /></Piece>
      <Piece position={[0, 0.58, 0]} color={color} dim={dim}><torusGeometry args={[0.27, 0.08, 8, 24]} /></Piece>
      <Piece position={[0.27, 0.72, 0]} color={tint(color, "#ffffff", 0.3)} dim={dim} outline={pen}><coneGeometry args={[0.12, 0.24, 6]} /></Piece>
    </>
  );
}

function Gem({ color, dim, pen }: ObjectProps) {
  return (
    <>
      <Piece position={[0, 0.06, 0]} color={tint(color, "#ffffff", 0.5)} dim={dim} outline={pen}><cylinderGeometry args={[0.3, 0.34, 0.12, 12]} /></Piece>
      <Piece position={[0, 0.7, 0]} rotation={[0, Math.PI / 4, 0]} color={color} dim={dim} outline={pen}><octahedronGeometry args={[0.34, 0]} /></Piece>
    </>
  );
}

function Page({ color, dim, pen }: ObjectProps) {
  return (
    <group rotation={[0, -0.18, 0]}>
      <Piece position={[0, 0.4, 0]} color={color} dim={dim} outline={pen}><boxGeometry args={[0.5, 0.7, 0.06]} /></Piece>
      {[0.58, 0.44, 0.3].map((y, i) => (
        <Piece key={y} position={[i === 2 ? -0.05 : 0, y, 0.04]} color={INK} dim={dim}><boxGeometry args={[i === 2 ? 0.24 : 0.34, 0.035, 0.012]} /></Piece>
      ))}
    </group>
  );
}

function Block({ color, dim, pen }: ObjectProps) {
  return <Piece position={[0, 0.25, 0]} color={color} dim={dim} outline={pen}><boxGeometry args={[0.45, 0.45, 0.45]} /></Piece>;
}

/** A plain stand-in used when there are very many plans: one cone per plan, no pen work. */
function Pawn({ color, dim }: ObjectProps) {
  return <Piece position={[0, 0.4, 0]} color={color} dim={dim}><coneGeometry args={[0.3, 0.8, 8]} /></Piece>;
}

const SHAPES: Record<PlanKind, (p: ObjectProps) => ReactNode> = {
  agent: Robot,
  workflow: Ring,
  skill: Gem,
  document: Page,
  unspecified: Block,
};

/** A small flag on a pole, in the colour of the worst alert of the plan. */
function AlertFlag({ color, dim }: { color: string; dim: boolean }) {
  const flag = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(0, 0).lineTo(0.3, -0.1).lineTo(0, -0.2).closePath();
    return new THREE.ShapeGeometry(s);
  }, []);
  return (
    <group position={[0.46, 0.75, 0]}>
      <Piece position={[0, 0.25, 0]} color={INK} dim={dim}><cylinderGeometry args={[0.014, 0.014, 0.5, 5]} /></Piece>
      <mesh geometry={flag} position={[0.01, 0.5, 0]} raycast={() => null}>
        <meshBasicMaterial color={color} side={THREE.DoubleSide} toneMapped={false} transparent={dim} opacity={dim ? 0.2 : 1} />
      </mesh>
    </group>
  );
}

const SIGN_W = 0.96; // narrow enough to stay clear of the objects one row nearer
const SIGN_H = 0.58;
const PAPER = "#f6f1e4";

/** A little signboard at the foot of an object, leaning back toward the viewer, with the plan's name on it. */
function NameSign({ title, pen }: { title: string; pen: string }) {
  const texture = useMemo(() => nameTexture(title, SIGN_W - 0.1, SIGN_H - 0.06), [title]);
  return (
    <group position={[0, 0.2, 0.56]} rotation={[-0.95, 0, 0]}>
      {[-0.36, 0.36].map((x) => (
        <Piece key={x} position={[x, -0.12, -0.05]} rotation={[0.95, 0, 0]} color={pen} dim={false}><boxGeometry args={[0.04, 0.2, 0.04]} /></Piece>
      ))}
      <Piece color={PAPER} dim={false} outline={pen}><boxGeometry args={[SIGN_W, SIGN_H, 0.03]} /></Piece>
      <mesh position={[0, 0, 0.017]} raycast={() => null}>
        <planeGeometry args={[SIGN_W - 0.1, SIGN_H - 0.06]} />
        <meshBasicMaterial map={texture} transparent depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  );
}

interface PlanObjectProps {
  plan: PlanRecord;
  position: V3;
  palette: Palette;
  selected: boolean;
  hovered: boolean;
  dim: boolean;
  simple: boolean; // pawn instead of the full object
  named: boolean; // show the plan's name (on an opened island): on a robot's shirt, or on a signboard in front of other objects
  onPick: () => void;
  onHover: (on: boolean) => void;
}

/** One plan on its island. */
export function PlanObject({ plan, position, palette, selected, hovered, dim, simple, named, onPick, onHover }: PlanObjectProps) {
  const color = stageOf(plan).color;
  const Shape = simple ? Pawn : SHAPES[plan.kind] ?? Block;
  const severity = tagSeverity(plan);
  const scale = (selected ? 1.4 : hovered ? 1.18 : 1) * 1.15;
  const title = plan.title || plan.slug;
  const onShirt = named && !simple && plan.kind === "agent";
  const props: ObjectProps = { color, dim, pen: palette.edge, name: onShirt ? title : undefined };
  const handlers = dim
    ? {}
    : {
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
      };
  return (
    <group position={position} {...handlers}>
      {/* a soft patch of shade under it, and a ring when selected */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} raycast={() => null}>
        <circleGeometry args={[0.46, 16]} />
        <meshBasicMaterial color="#000000" transparent opacity={dim ? 0.04 : 0.16} depthWrite={false} toneMapped={false} />
      </mesh>
      {selected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]} raycast={() => null}>
          <ringGeometry args={[0.62, 0.72, 28]} />
          <meshBasicMaterial color="#ffffff" toneMapped={false} />
        </mesh>
      )}
      <group scale={scale}>
        <Shape {...props} />
        {severity && !simple && <AlertFlag color={ALERT_COLOR[severity]} dim={dim} />}
      </group>
      {named && !simple && !dim && !onShirt && <NameSign title={title} pen={palette.edge} />}
    </group>
  );
}
