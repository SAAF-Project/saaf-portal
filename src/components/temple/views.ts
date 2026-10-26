import { lazy, type ComponentType, type LazyExoticComponent } from "react";
import type { Theme } from "./colors";
import type { Matcher } from "./filters";
import type { RelationEdge } from "./relations";
import type { Focus, ProgressData } from "./types";

/**
 * What every visualisation receives. The side panel, filters, information screen and links are shared and drive
 * `focus` (project, part, plan, annex); a visualisation only has to draw the data and report clicks.
 */
export interface VisualProps {
  data: ProgressData;
  theme: Theme;
  focus: Focus;
  matches: Matcher;
  filtersActive: boolean;
  sketch: boolean;
  scenery: boolean; // decoration on or off (photoreal backdrop in the temple, trees and boats on the islands)
  assetBase: string;
  debug: boolean;
  onFocus: (f: Focus) => void;
  relations: RelationEdge[]; // which plan feeds which (checked against the plans)
  onInfo: (topic?: "relations") => void; // opens the "How to read this" screen, optionally at one topic
}

export interface ViewDefinition {
  id: string;
  label: string; // the switch in the header
  shortLabel?: string; // the same, on narrow screens
  title: string; // what the whole picture is called (panel, breadcrumb, banner)
  about: string; // one paragraph for the information screen
  component: LazyExoticComponent<ComponentType<VisualProps>>;
}

/**
 * The visualisations. Each is loaded only when shown. To remove one: delete its folder and its line here;
 * links that still say ?view=<id> fall back to the first one.
 */
export const VIEWS: ViewDefinition[] = [
  {
    id: "temple",
    label: "Temple",
    title: "The SAAF Temple",
    about:
      "The foundation is the shared infrastructure (Track 0), the four pillars are the audit stages (planning, collection and extraction, reporting and visualisation, monitoring), the roof is AI governance and quality assurance, and the Repo Annex beside it holds plans whose repo needs attention. Every plan covers the same surface of its part, so a colour's share of a block is its share of the plans.",
    component: lazy(() => import("./Temple").then((m) => ({ default: m.Temple }))),
  },
  {
    id: "islands",
    label: "Islands",
    title: "The SAAF Archipelago",
    about:
      "Governance and quality assurance is the island at the back, the four audit stages are the islands in the middle (planning, collection and extraction, reporting and visualisation, monitoring) with bridges and dashed arrows for the flow of an audit, and the shared infrastructure is the island in front that supports them all. The Repo Annex is a small island beside them. Every plan is an object on its island: a robot for an agent, a ring for a workflow, a gem for a skill, a page for a document. Its colour is its stage, red at the front of an island to green at the back, and an island grows with the number of plans on it.",
    component: lazy(() => import("./landscape/Landscape").then((m) => ({ default: m.Landscape }))),
  },
  {
    id: "dependencies",
    label: "Agent dependencies",
    shortLabel: "Deps",
    title: "SAAF Agent Dependencies",
    about:
      "A flat map of which plan's output is another plan's input. Each lane is a part (governance on top, the four audit stages in the reverse order of the other views, the shared infrastructure at the bottom) and the columns follow the order of the work, so every arrow points to the plan that uses what the other produces; the label on an arrow says what flows. Each card is a plan in its stage colour. Dashed arrows are suggestions an AI read from the plan texts and that no owner has confirmed yet; solid arrows are confirmed. Click a plan to light up everything it depends on and everything that depends on it; plans without any documented input or output are hidden until you switch them on. Drag to move; zoom with the slider under the notice, the mouse wheel or a pinch, and Fit frames the current selection again.",
    component: lazy(() => import("./flow/Flow").then((m) => ({ default: m.Flow }))),
  },
];

export const DEFAULT_VIEW = VIEWS[0].id;

/** The view a link or a stored choice asks for; an unknown id falls back to the first view. */
export function resolveView(id: string | null | undefined): ViewDefinition {
  return VIEWS.find((v) => v.id === id) ?? VIEWS[0];
}
