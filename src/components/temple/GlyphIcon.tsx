import { GLYPH_PATHS } from "./glyphs";
import type { PlanKind } from "./types";

/** The symbol of a kind of plan, drawn from the same path as on the 3D pieces. */
export function GlyphIcon({ kind, size = 14 }: { kind: PlanKind; size?: number }) {
  const path = GLYPH_PATHS[kind];
  if (!path) return <i className="glyph-none" style={{ width: size, height: size }} />;
  return (
    <svg className="glyph" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d={path} fillRule="evenodd" fill="currentColor" />
    </svg>
  );
}
