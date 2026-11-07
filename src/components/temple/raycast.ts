import * as THREE from "three";

/**
 * What a mesh's `raycast` prop should be. A dimmed piece must not be clickable (no ray hits), a normal piece must be.
 * Passing `undefined` for "normal" is not enough: react-three-fiber does not put the default back once the prop was a
 * function, so a piece that was dimmed once stayed unclickable until a reload.
 */
export const NO_RAY = () => null;
export const rayFor = (dim: boolean) => (dim ? NO_RAY : THREE.Mesh.prototype.raycast);
