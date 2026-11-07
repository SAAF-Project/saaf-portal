/**
 * The visualization.yaml contract: what a visualisation says about itself.
 *
 * Every visualisation (Temple, Islands, Agent dependencies, ...) has a folder `views/<id>/` with a
 * `visualization.yaml` and a preview picture. The shared engine (data, filters, side panel, tour, chooser) reads these
 * files; a visualisation itself is frontend-only: it receives the data and reports clicks, it never writes data.
 * The format is documented in `views/README.md`. This file only holds the types and the checks, so it is pure and tested.
 */
import type { Focus } from "./types";

/** Display preferences a visualisation can support. Each one is a personal choice, remembered per person. */
export const DISPLAY_OPTIONS = ["scenery", "style"] as const;
export type DisplayOption = (typeof DISPLAY_OPTIONS)[number];

/**
 * Places on the page a tour step can point at (the element has `data-tour="<target>"`).
 * `view` is the picture itself: the step then moves the camera (see `focus`) instead of highlighting a box.
 */
export const TOUR_TARGETS = ["view", "views", "filters", "display", "tour", "panel", "legend"] as const;
export type TourTarget = (typeof TOUR_TARGETS)[number];

export interface TourStep {
  title: string;
  text: string;
  target?: TourTarget; // highlight this part of the page
  focus?: Focus; // move the view to this block first (project, a part, or the annex)
}

export interface VisualisationManifest {
  id: string;
  name: string; // the tile and the switch in the header
  shortName?: string; // the same, on narrow screens
  title: string; // what the whole picture is called (panel, breadcrumb)
  description: string; // a few words on the chooser tile
  preview: string; // picture next to the yaml
  access: "community"; // reserved for later; community = everyone who can open the portal
  supports: { filters: boolean; display: DisplayOption[]; relations: boolean };
  calculation: string[]; // a few lines for "How this is calculated", about this view only
  tour: TourStep[];
}

const ID = /^[a-z][a-z0-9-]*$/;
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

function text(raw: Record<string, unknown>, key: string, where: string, required = true): string {
  const v = raw[key];
  if (typeof v === "string" && v.trim()) return v.trim();
  if (v === undefined && !required) return "";
  throw new Error(`${where}: "${key}" must be a non-empty text`);
}

function unknownKeys(raw: Record<string, unknown>, allowed: string[], where: string) {
  const extra = Object.keys(raw).filter((k) => !allowed.includes(k));
  if (extra.length) throw new Error(`${where}: unknown field${extra.length > 1 ? "s" : ""} ${extra.map((k) => `"${k}"`).join(", ")}`);
}

function parseFocus(v: unknown, where: string): Focus {
  if (!isObject(v)) throw new Error(`${where}: "focus" must be an object like { level: part, part: planning }`);
  if (v.level === "project") return { level: "project" };
  if (v.level === "annex") return { level: "annex" };
  if (v.level === "part" && typeof v.part === "string" && v.part) return { level: "part", partId: v.part };
  throw new Error(`${where}: "focus" must be level project, annex, or part with a part id`);
}

function parseStep(v: unknown, where: string): TourStep {
  if (!isObject(v)) throw new Error(`${where}: a tour step must be an object with a title and text`);
  unknownKeys(v, ["title", "text", "target", "focus"], where);
  const step: TourStep = { title: text(v, "title", where), text: text(v, "text", where) };
  if (v.target !== undefined) {
    if (!TOUR_TARGETS.includes(v.target as TourTarget)) throw new Error(`${where}: "target" must be one of ${TOUR_TARGETS.join(", ")}`);
    step.target = v.target as TourTarget;
  }
  if (v.focus !== undefined) step.focus = parseFocus(v.focus, where);
  return step;
}

/** Turns what js-yaml read into a checked manifest. Throws a readable error that names the file and the field. */
export function parseManifest(raw: unknown, source: string): VisualisationManifest {
  if (!isObject(raw)) throw new Error(`${source}: the file must be a mapping`);
  unknownKeys(raw, ["id", "name", "short_name", "title", "description", "preview", "access", "supports", "calculation", "tour"], source);

  const id = text(raw, "id", source);
  if (!ID.test(id)) throw new Error(`${source}: "id" must be lowercase letters, digits and dashes`);

  const access = raw.access ?? "community";
  if (access !== "community") throw new Error(`${source}: "access" must be "community" (other values are reserved for later)`);

  const s = raw.supports ?? {};
  if (!isObject(s)) throw new Error(`${source}: "supports" must be a mapping`);
  unknownKeys(s, ["filters", "display", "relations"], `${source} supports`);
  const display = s.display ?? [];
  if (!Array.isArray(display) || display.some((d) => !DISPLAY_OPTIONS.includes(d as DisplayOption))) {
    throw new Error(`${source}: supports.display must be a list of ${DISPLAY_OPTIONS.join(", ")}`);
  }
  for (const key of ["filters", "relations"] as const) {
    if (s[key] !== undefined && typeof s[key] !== "boolean") throw new Error(`${source}: supports.${key} must be true or false`);
  }

  const calculation = raw.calculation ?? [];
  if (!Array.isArray(calculation) || calculation.some((c) => typeof c !== "string" || !c.trim())) {
    throw new Error(`${source}: "calculation" must be a list of short texts`);
  }
  const tour = raw.tour ?? [];
  if (!Array.isArray(tour) || tour.length === 0) throw new Error(`${source}: "tour" needs at least one step`);

  const shortName = text(raw, "short_name", source, false);
  return {
    id,
    name: text(raw, "name", source),
    ...(shortName ? { shortName } : {}),
    title: text(raw, "title", source),
    description: text(raw, "description", source),
    preview: text(raw, "preview", source),
    access,
    supports: { filters: s.filters !== false, display: [...new Set(display as DisplayOption[])], relations: s.relations === true },
    calculation: (calculation as string[]).map((c) => c.trim()),
    tour: tour.map((step, i) => parseStep(step, `${source} tour step ${i + 1}`)),
  };
}
