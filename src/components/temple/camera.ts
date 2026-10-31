import type { Layout } from "./layout";
import type { Focus } from "./types";

type V3 = [number, number, number];
export interface CameraTarget {
  pos: V3;
  target: V3;
}

/** Viewport facts the framing depends on. panelFrac = share of the width covered by the side panel. */
export interface View {
  aspect: number;
  panelFrac: number;
  fov: number; // vertical, degrees
}

export function focusKey(f: Focus): string {
  switch (f.level) {
    case "project":
      return "project";
    case "part":
      return `part:${f.partId}`;
    case "plan":
      return `plan:${f.slug}`;
    case "annex":
      return `annex:${f.slug ?? ""}`;
  }
}

/**
 * Frame a box (width x height as seen from the camera) so it fits in the part of the screen
 * that is not covered by the side panel. `elevation` is the viewing angle above the horizon.
 */
export function frame(center: V3, width: number, height: number, elevationDeg: number, view: View, padding = 1.2): CameraTarget {
  const k = 2 * Math.tan((view.fov * Math.PI) / 360);
  const free = Math.max(0.4, 1 - view.panelFrac);
  const dist = Math.max((width * padding) / free / (k * view.aspect), (height * padding) / k);
  const shift = (view.panelFrac / 2) * k * dist * view.aspect; // moves the subject into the free area
  const el = (elevationDeg * Math.PI) / 180;
  const target: V3 = [center[0] + shift, center[1], center[2]];
  return { target, pos: [target[0], target[1] + dist * Math.sin(el), target[2] + dist * Math.cos(el)] };
}

export function cameraFor(focus: Focus, layout: Layout, partKind: (id: string) => string | undefined, view: View): CameraTarget {
  // First screen: the whole temple and the annex beside it, with room for the banner above.
  const overview = () => {
    const w = layout.maxX - layout.minX;
    const h = layout.topY + 3.2;
    return frame([(layout.minX + layout.maxX) / 2, h / 2 - 0.4, 0], w, h + 1.5, 15, view, 1.12);
  };

  switch (focus.level) {
    case "project":
      return overview();
    case "part": {
      const box = layout.partBox[focus.partId];
      if (!box) return overview();
      const kind = partKind(focus.partId);
      if (kind === "foundation") return frame([box.center[0], 0.3, 0], box.size[0] + 1, box.size[2] + 1.5, 68, view);
      if (kind === "roof") return frame([box.center[0], box.center[1], 0], box.size[0] + 1, box.size[1] + 1.8, 14, view);
      if (kind === "quarry") return frame(box.center, 6, 5, 35, view);
      return frame(box.center, box.size[0] + 2.5, box.size[1] + 2.4, 14, view);
    }
    case "plan": {
      const cell = layout.cells[focus.slug];
      if (!cell) return overview();
      const [w, h] = cell.size;
      const flat = cell.partId === "foundation";
      return flat
        ? frame(cell.pos, Math.max(10, w * 2.6), 6, 42, view, 1.2)
        : frame([cell.pos[0], cell.pos[1], cell.pos[2]], Math.max(9, w * 3), Math.max(5.5, h * 3), 13, view, 1.15);
    }
    case "annex": {
      const cell = focus.slug ? layout.annexCells[focus.slug] : undefined;
      if (cell) {
        const [w, h] = cell.size;
        return frame([cell.pos[0], cell.pos[1], cell.pos[2]], Math.max(8, w * 3), Math.max(5.5, h * 3), 13, view, 1.15);
      }
      const b = layout.partBox["annex"];
      return frame(b.center, b.size[0] + 2.5, b.size[1] + 2.4, 14, view);
    }
  }
}
