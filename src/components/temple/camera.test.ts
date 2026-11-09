import { describe, expect, it } from "vitest";
import { frame, type View } from "./camera";

const wide: View = { aspect: 1.6, panelFrac: 0, fov: 40 };
const portrait: View = { aspect: 390 / 844, panelFrac: 0, fov: 40 };

describe("framing", () => {
  it("fits the whole subject across a narrow screen: a portrait screen pulls the camera back", () => {
    const w = frame([0, 5, 0], 30, 12, 15, wide);
    const p = frame([0, 5, 0], 30, 12, 15, portrait);
    const distance = (c: { pos: number[]; target: number[] }) => Math.hypot(c.pos[0] - c.target[0], c.pos[1] - c.target[1], c.pos[2] - c.target[2]);
    expect(distance(p)).toBeGreaterThan(distance(w) * 1.5);
  });

  it("keeps the subject centred on a wide screen, and lifts it on a portrait one so the bottom stays free for the sheet", () => {
    expect(frame([0, 5, 0], 30, 12, 15, wide).target[1]).toBe(5);
    expect(frame([0, 5, 0], 30, 12, 15, portrait).target[1]).toBeLessThan(5);
  });

  it("a portrait screen does not move the subject sideways", () => {
    expect(frame([3, 5, 0], 30, 12, 15, portrait).target[0]).toBe(3);
  });
});
