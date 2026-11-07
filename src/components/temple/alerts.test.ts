import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { ALERT_COLOR, hasAlert, severityRank, tagSeverity } from "./alerts";
import { GLYPH_KINDS, GLYPH_PATHS, KIND_LABEL, KIND_LABEL_PLURAL } from "./glyphs";
import { glyphSize } from "./tags";
import type { AlertRecord, ProgressData } from "./types";

const data = JSON.parse(readFileSync(resolve(process.cwd(), "public/data/progress.json"), "utf8")) as ProgressData;
const alert = (id: string, severity: AlertRecord["severity"]): AlertRecord => ({ id, severity, message: id });

describe("alert tags", () => {
  it("tags a piece by its worst error or warning, and never by a note", () => {
    expect(tagSeverity({ alerts: [] })).toBeNull();
    expect(tagSeverity({ alerts: [alert("status-draft", "info")] })).toBeNull();
    expect(tagSeverity({ alerts: [alert("a", "info"), alert("b", "warning")] })).toBe("warning");
    expect(tagSeverity({ alerts: [alert("b", "warning"), alert("c", "error"), alert("a", "info")] })).toBe("error");
  });

  it("ranks conflicts above warnings above notes, each with its own colour", () => {
    expect(severityRank("error")).toBeGreaterThan(severityRank("warning"));
    expect(severityRank("warning")).toBeGreaterThan(severityRank("info"));
    expect(new Set(Object.values(ALERT_COLOR)).size).toBe(3);
    expect(hasAlert({ alerts: [alert("x", "info")] }, "x")).toBe(true);
    expect(hasAlert({ alerts: [] }, "x")).toBe(false);
  });

  it("leaves most pieces untagged, so a tag still means something", () => {
    const tagged = data.plans.filter((p) => tagSeverity(p)).length;
    expect(tagged).toBeGreaterThan(0);
    expect(tagged).toBeLessThan(data.plans.length / 2);
  });
});

describe("type glyphs", () => {
  it("has a distinct symbol for agents, workflows, skills and documents", () => {
    expect(GLYPH_KINDS.sort()).toEqual(["agent", "document", "skill", "workflow"]);
    const paths = GLYPH_KINDS.map((k) => GLYPH_PATHS[k]!);
    expect(new Set(paths).size).toBe(paths.length);
    for (const d of paths) {
      expect(d.startsWith("M")).toBe(true);
      expect(d.endsWith("Z")).toBe(true);
      // every coordinate stays inside the 24 x 24 box the drawing code scales from
      for (const n of d.match(/-?\d+(\.\d+)?/g)!) expect(Number(n)).toBeGreaterThanOrEqual(0);
      for (const n of d.match(/-?\d+(\.\d+)?/g)!) expect(Number(n)).toBeLessThanOrEqual(24);
    }
  });

  it("names every kind the generator produces", () => {
    for (const k of data.kinds) {
      expect(KIND_LABEL[k]).toBeTruthy();
      expect(KIND_LABEL_PLURAL[k]).toBeTruthy();
    }
  });

  it("draws a symbol only where the face is big enough to read it", () => {
    const rect = (w: number, h: number) => [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]] as [number, number][];
    expect(glyphSize(rect(0.4, 3))).toBe(0);
    expect(glyphSize(rect(2, 2))).toBeGreaterThan(0);
    expect(glyphSize(rect(20, 20))).toBeLessThanOrEqual(1.1);
  });
});
