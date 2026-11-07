import { createContext, useContext, useId, useLayoutEffect, useRef } from "react";
import * as THREE from "three";
import { Edges } from "@react-three/drei";
import { hashString, wobbleSegments } from "./sketch";

/** True when the scene is drawn in the hand-drawn style. */
export const SketchContext = createContext(false);

/** Pen strokes along the hard edges of the parent mesh: two wobbly lines per edge. */
function SketchLines({ color, threshold }: { color: string; threshold: number }) {
  const ref = useRef<THREE.LineSegments>(null);
  const seed = hashString(useId());

  useLayoutEffect(() => {
    const lines = ref.current;
    const parent = lines?.parent as THREE.Mesh | undefined;
    if (!lines || !parent?.geometry) return;
    const edges = new THREE.EdgesGeometry(parent.geometry, threshold);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(wobbleSegments(edges.getAttribute("position").array, seed), 3));
    edges.dispose();
    lines.geometry.dispose();
    lines.geometry = geometry;
    return () => geometry.dispose();
  });

  return (
    <lineSegments ref={ref} raycast={() => null}>
      <lineBasicMaterial color={color} transparent opacity={0.85} toneMapped={false} />
    </lineSegments>
  );
}

/** Outline of the parent mesh: clean lines, or hand-drawn strokes in the sketch style. */
export function Outline({ color, threshold = 15 }: { color: string; threshold?: number }) {
  const sketch = useContext(SketchContext);
  return sketch ? <SketchLines color={color} threshold={threshold} /> : <Edges color={color} threshold={threshold} />;
}
