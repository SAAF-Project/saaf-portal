import type { Theme } from "../colors";

/** Colours of the archipelago. Soft, flat, like a coloured drawing; the stage colours of the objects stay pure. */
export interface Palette {
  sea: string;
  seaLine: string; // grid and wave strokes
  grass: string;
  rock: string;
  trunk: string;
  leaf: string;
  stone: string;
  edge: string; // pen
  ink: string; // arrows and text
}

export const PALETTE: Record<Theme, Palette> = {
  dark: { sea: "#173257", seaLine: "#7fb2e6", grass: "#74a06c", rock: "#6f6659", trunk: "#7a5c40", leaf: "#4f8a58", stone: "#c9c3b4", edge: "#0e1830", ink: "#dbe7f7" },
  light: { sea: "#cfe6f5", seaLine: "#4f86b3", grass: "#a8d093", rock: "#b3a48a", trunk: "#8a6a4a", leaf: "#6fae6b", stone: "#ece6d6", edge: "#2b3a55", ink: "#1b2a44" },
};
