import type { PlanKind } from "./types";

/**
 * One small symbol per kind of plan. Each is a single SVG path in a 24 x 24 box (filled with the even-odd rule),
 * so the 3D pieces (canvas Path2D) and the legend (inline SVG) draw exactly the same shape.
 */

/** A robot: antenna, square head with ears, two eyes and a mouth cut out, and a neck. */
const ROBOT =
  "M11 1.5H13V4H17.5L20 6.5V16.5L17.5 19H6.5L4 16.5V6.5L6.5 4H11Z" + // head with antenna
  "M7.5 8.5H10.5V11.5H7.5ZM13.5 8.5H16.5V11.5H13.5Z" + // eyes
  "M8 14.2H16V15.8H8Z" + // mouth
  "M1.5 9H3V14H1.5ZM21 9H22.5V14H21Z" + // ears
  "M9 20.5H15V22.5H9Z"; // neck

export const GLYPH_PATHS: Partial<Record<PlanKind, string>> = {
  agent: ROBOT,
  // two arrows going round: a process
  workflow: "M3 7H15V4L21 9L15 14V11H3ZM21 16H9V13L3 18L9 23V20H21Z",
  // a four-pointed spark
  skill: "M12 2L14.6 9.4L22 12L14.6 14.6L12 22L9.4 14.6L2 12L9.4 9.4Z",
  // a page with lines of text
  document: "M5 2H14L19 7V22H5ZM8 8H11V9.6H8ZM8 12H16V13.6H8ZM8 16H16V17.6H8Z",
};

export const KIND_LABEL: Record<PlanKind, string> = {
  agent: "Agent",
  workflow: "Workflow",
  skill: "Skill",
  document: "Document",
  unspecified: "Unspecified",
};

export const KIND_LABEL_PLURAL: Record<PlanKind, string> = {
  agent: "Agents",
  workflow: "Workflows",
  skill: "Skills",
  document: "Documents",
  unspecified: "Unspecified",
};

/** Kinds that have a symbol (the others are drawn without one). */
export const GLYPH_KINDS = Object.keys(GLYPH_PATHS) as PlanKind[];
