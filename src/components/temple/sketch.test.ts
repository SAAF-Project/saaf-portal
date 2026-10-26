import { describe, expect, it } from "vitest";
import { hash, hashString, wobbleAmount, wobbleSegments } from "./sketch";

const line = [0, 0, 0, 4, 0, 0]; // one segment, 4 units long along x

describe("hand-drawn strokes", () => {
  it("is deterministic: same seed, same drawing; another seed, another drawing", () => {
    expect(Array.from(wobbleSegments(line, 7))).toEqual(Array.from(wobbleSegments(line, 7)));
    expect(Array.from(wobbleSegments(line, 7))).not.toEqual(Array.from(wobbleSegments(line, 8)));
  });

  it("draws every edge twice and as several short pieces", () => {
    const one = wobbleSegments(line, 1, 1);
    const two = wobbleSegments(line, 1, 2);
    expect(two.length).toBe(one.length * 2);
    expect(two.length % 6).toBe(0);
    expect(one.length / 6).toBeGreaterThan(2); // a 4-unit edge is cut into several pieces
  });

  it("stays close to the true edge, only overshooting its ends a little", () => {
    const pts = wobbleSegments(line, 3);
    const amp = wobbleAmount(4);
    for (let i = 0; i < pts.length; i += 3) {
      expect(Math.abs(pts[i + 1])).toBeLessThanOrEqual(amp + 1e-6); // sideways wobble
      expect(Math.abs(pts[i + 2])).toBeLessThanOrEqual(amp + 1e-6);
      expect(pts[i]).toBeGreaterThan(-0.3);
      expect(pts[i]).toBeLessThan(4.3);
    }
  });

  it("skips empty edges and tolerates no input", () => {
    expect(wobbleSegments([1, 1, 1, 1, 1, 1]).length).toBe(0);
    expect(wobbleSegments([]).length).toBe(0);
  });

  it("hashes into [0, 1) and differs per string", () => {
    for (let i = 0; i < 200; i++) {
      expect(hash(i)).toBeGreaterThanOrEqual(0);
      expect(hash(i)).toBeLessThan(1);
    }
    expect(hashString(":r1:")).not.toBe(hashString(":r2:"));
  });
});
