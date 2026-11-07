/**
 * Hand-drawn look for outlines: every straight edge becomes two slightly different, wobbly strokes that overshoot
 * their ends a little, like a pen going over a ruler line twice. Pure and deterministic (same seed, same drawing),
 * so the lines do not flicker between frames.
 */

/** Deterministic pseudo-random number in [0, 1) for an integer. */
export function hash(n: number): number {
  let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

/** Hash of a string (for per-object seeds). */
export function hashString(s: string): number {
  let h = 17;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return h >>> 0;
}

/** Largest sideways wobble of a stroke of length `len` (world units). */
export const wobbleAmount = (len: number) => 0.03 + 0.01 * Math.min(len, 6);

/**
 * @param positions pairs of 3D points (x1,y1,z1,x2,y2,z2 per segment), as in a THREE.EdgesGeometry
 * @returns line-segment positions of the wobbly strokes, in the same format
 */
export function wobbleSegments(positions: ArrayLike<number>, seed = 1, strokes = 2): Float32Array {
  const out: number[] = [];
  const count = Math.floor(positions.length / 6);
  for (let i = 0; i < count; i++) {
    const a = [positions[i * 6], positions[i * 6 + 1], positions[i * 6 + 2]];
    const b = [positions[i * 6 + 3], positions[i * 6 + 4], positions[i * 6 + 5]];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    if (len < 1e-6) continue;
    for (let k = 0; k < strokes; k++) {
      const id = Math.imul(seed, 100003) + i * 131 + k * 7919;
      const over = (0.03 + 0.07 * hash(id + 1)) / len; // overshoot at the start and the end, as a fraction of the length
      const t0 = -over * (0.4 + hash(id + 2));
      const t1 = 1 + over * (0.4 + hash(id + 3));
      const n = Math.max(2, Math.ceil(len / 1.1) + 1);
      const amp = wobbleAmount(len);
      let prev: number[] | null = null;
      for (let j = 0; j < n; j++) {
        const t = t0 + ((t1 - t0) * j) / (n - 1);
        const p = [0, 1, 2].map((c) => a[c] + (b[c] - a[c]) * t + amp * (hash(id + 10 + j * 3 + c) - 0.5) * 2);
        if (prev) out.push(...prev, ...p);
        prev = p;
      }
    }
  }
  return new Float32Array(out);
}

/**
 * SVG path of a hand-drawn rectangle outline (screen units): every side drawn twice, a little bowed, overshooting its
 * corners. For the flat dependency map; the same seed always draws the same outline.
 */
export function wobblyRectPath(x: number, y: number, w: number, h: number, seed: number, amp = 1.3): string {
  const corners = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
  const f = (n: number) => Math.round(n * 10) / 10;
  let d = "";
  for (let k = 0; k < 2; k++) {
    for (let i = 0; i < 4; i++) {
      const [a, b] = [corners[i], corners[(i + 1) % 4]];
      const id = Math.imul(seed, 7919) + k * 131 + i * 17;
      const j = (n: number) => (hash(id + n) - 0.5) * 2 * amp;
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const [ux, uy] = [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
      const o0 = 1 + 3 * hash(id + 7), o1 = 1 + 3 * hash(id + 8);
      const s = [a[0] - ux * o0 + j(1), a[1] - uy * o0 + j(2)];
      const e = [b[0] + ux * o1 + j(3), b[1] + uy * o1 + j(4)];
      const m = [(s[0] + e[0]) / 2 - uy * j(5), (s[1] + e[1]) / 2 + ux * j(5)];
      d += `M${f(s[0])} ${f(s[1])}Q${f(m[0])} ${f(m[1])} ${f(e[0])} ${f(e[1])}`;
    }
  }
  return d;
}
