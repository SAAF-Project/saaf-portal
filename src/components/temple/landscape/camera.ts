import { frame, type CameraTarget, type View } from "../camera";
import type { Focus, PlanRecord } from "../types";
import { ISLAND_TOP, slotOf, type LandscapeLayout } from "./layout";

/** Where the camera goes for each level: the whole archipelago, one island, one object. */
export function landscapeCameraFor(focus: Focus, layout: LandscapeLayout, planOf: (slug: string) => PlanRecord | undefined, view: View): CameraTarget {
  const { bounds } = layout;
  const overview = () => {
    const el = 40;
    const depth = bounds.maxZ - bounds.minZ;
    return frame([(bounds.minX + bounds.maxX) / 2, 0.5, (bounds.minZ + bounds.maxZ) / 2], bounds.maxX - bounds.minX, depth * Math.sin((el * Math.PI) / 180) + 4, el, view, 1.2);
  };
  const island = (id: string) => {
    const i = layout.islands[id];
    if (!i) return overview();
    return frame([i.center[0], ISLAND_TOP, i.center[1]], 2 * i.rx + 3, 2 * i.rz * Math.sin((44 * Math.PI) / 180) + 4.5, 44, view, 1.08);
  };
  const object = (id: string, slug: string) => {
    const slot = slotOf(layout, id, slug);
    if (!slot) return island(id);
    return frame([slot.pos[0], ISLAND_TOP + 0.6, slot.pos[1]], 13, 7.5, 36, view, 1.1);
  };

  switch (focus.level) {
    case "project":
      return overview();
    case "part":
      return island(focus.partId);
    case "plan": {
      const plan = planOf(focus.slug);
      return plan ? object(plan.part, plan.slug) : overview();
    }
    case "annex":
      return focus.slug ? object("annex", focus.slug) : island("annex");
  }
}
