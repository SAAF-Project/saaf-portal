import type { PhaseStatus, RepoStatus } from "./types";

export type Theme = "dark" | "light";

// Stage colours (red -> green) live in stages.ts. Repo markers use a separate blue-violet family so the
// two signals never clash: the stage says how far a plan is, the marker says what is up with its repo.
export const REPO_COLOR: Record<RepoStatus, string> = {
  missing: "#a58df2", // soft violet: stripes
  duplicate: "#6f7ff0", // soft indigo: frame
  "main-repo": "#5fb4ee", // soft sky: frame
  dedicated: "#80cf93",
  "not-needed": "#a3aec2",
};

export const REPO_LABEL: Record<RepoStatus, string> = {
  missing: "No repo",
  duplicate: "Duplicate repos",
  "main-repo": "In main repo",
  dedicated: "Own repo",
  "not-needed": "No repo needed",
};

// The four PDCA layers of an opened plan: done / under way / not started.
export const PHASE_COLOR: Record<PhaseStatus, string> = {
  complete: "#80cf93",
  in_progress: "#efd070",
  not_started: "#a3aec2",
};

export const UNKNOWN_COLOR = "#8b94a5";

export interface Palette {
  background: string;
  ground: string;
  structure: string; // neutral stone (plinths, annex roof)
  edge: string; // outlines of blocks
  ink: string; // text and lines
}

export const PALETTE: Record<Theme, Palette> = {
  dark: { background: "#151d31", ground: "#1b2540", structure: "#475673", edge: "#222c47", ink: "#e2e8f0" },
  light: { background: "#f2f5fb", ground: "#e4e9f3", structure: "#cdd5e6", edge: "#55607e", ink: "#0f172a" },
};
