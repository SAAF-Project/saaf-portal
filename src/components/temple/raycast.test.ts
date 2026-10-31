import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { NO_RAY, rayFor } from "./raycast";

describe("rayFor", () => {
  it("gives a dimmed piece a raycast that never hits", () => {
    expect(rayFor(true)).toBe(NO_RAY);
    expect(NO_RAY()).toBeNull();
  });

  it("gives a normal piece the real mesh raycast, not undefined (react-three-fiber would not restore it)", () => {
    expect(rayFor(false)).toBe(THREE.Mesh.prototype.raycast);
    expect(rayFor(false)).toBeTypeOf("function");
  });
});
