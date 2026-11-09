import { lazy, type ComponentType, type LazyExoticComponent } from "react";
import type { Theme } from "./colors";
import type { Matcher } from "./filters";
import type { RelationEdge } from "./relations";
import type { Focus, ProgressData } from "./types";
import type { VisualisationManifest } from "./visualisation";
import dependenciesPreview from "./views/dependencies/preview.jpg";
import islandsPreview from "./views/islands/preview.jpg";
import templePreview from "./views/temple/preview.jpg";

/**
 * What every visualisation receives. The side panel, filters, information screen and links are shared and drive
 * `focus` (project, part, plan, annex); a visualisation only has to draw the data and report clicks.
 * It never writes data.
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
  onInfo: (topic?: "relations") => void; // opens "How this is calculated", optionally at one topic
  panelOpen?: boolean; // the side panel (a sheet on a phone) is open: a view that frames itself leaves room for it
  onReady?: () => void; // the picture has been drawn, textures and all: render <ViewReady onReady={onReady} /> last
}

/** A visualisation as the app uses it: what it says about itself (visualization.yaml) plus the code that draws it. */
export interface ViewDefinition extends VisualisationManifest {
  component: LazyExoticComponent<ComponentType<VisualProps>>;
  previewUrl: string;
}

// Next.js gives an imported picture as an object with a src, other tools as the url itself.
const url = (image: string | { src: string }) => (typeof image === "string" ? image : image.src);

/**
 * The registration: one entry per visualisation, in the order the chooser and the switch show them. The code is loaded
 * only when a view is shown. Everything else a view says about itself is in views/<id>/visualization.yaml, so adding a
 * view is a new folder there plus one entry here. To remove one: delete its folder and its entry; links that still say
 * view=<id> then show the chooser.
 */
export const REGISTRY: { id: string; preview: string | { src: string }; component: ViewDefinition["component"] }[] = [
  { id: "temple", preview: templePreview, component: lazy(() => import("./Temple").then((m) => ({ default: m.Temple }))) },
  { id: "islands", preview: islandsPreview, component: lazy(() => import("./landscape/Landscape").then((m) => ({ default: m.Landscape }))) },
  { id: "dependencies", preview: dependenciesPreview, component: lazy(() => import("./flow/Flow").then((m) => ({ default: m.Flow }))) },
];

/**
 * Joins the manifests (read from the yaml files by the host) with the registered code. A manifest without code, or code
 * without a manifest, is left out and reported once in the console: one broken view must not take down the others.
 */
export function buildViews(manifests: VisualisationManifest[]): ViewDefinition[] {
  const views: ViewDefinition[] = [];
  for (const reg of REGISTRY) {
    const manifest = manifests.find((m) => m.id === reg.id);
    if (!manifest) {
      console.warn(`[views] "${reg.id}" is registered but has no visualization.yaml`);
      continue;
    }
    views.push({ ...manifest, component: reg.component, previewUrl: url(reg.preview) });
  }
  for (const m of manifests) {
    if (!REGISTRY.some((r) => r.id === m.id)) console.warn(`[views] "${m.id}" has a visualization.yaml but is not registered in views.ts`);
  }
  return views;
}

/** The view a link or a stored choice asks for, or undefined when there is none (the chooser is shown then). */
export function findView(views: ViewDefinition[], id: string | null | undefined): ViewDefinition | undefined {
  return views.find((v) => v.id === id);
}

/** Which display preferences the buttons should offer for a view; none = no Display menu at all. */
export const displayOptionsOf = (view: Pick<ViewDefinition, "supports">) => view.supports.display;
