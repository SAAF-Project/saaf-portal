import { useEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from "react";
import type { RepoStandards } from "../../../lib/repo-standards";
import type { Focus } from "../types";
import { ViewReady } from "../ViewReady";
import type { VisualProps } from "../views";
import { marksFromPlans, repoForPlan, repoKey } from "./marks";
import { useStandards } from "./useStandards";
import { Wall } from "./Wall";
import "./wall.css";

/**
 * The Standards view of SAAF Visualised: per repo, how many of the nine standards are built in.
 *
 * The plans come from the shared engine like in every view. The repos and their checks come from one extra read-only
 * source, /api/standards, through the same hook as the standards board (fetched on arrival, then once a minute). The
 * two are joined here, on the repo name. A click on a face focuses its plan through the engine when the repo has one;
 * a repo without a plan is only selected here. The view never writes data.
 */

const focusKey = (f: Focus): string =>
  f.level === "plan" ? `plan/${f.slug}` : f.level === "part" ? `part/${f.partId}` : f.level === "annex" ? `annex/${f.slug ?? ""}` : "project";

/**
 * How much room the engine's legend takes at the bottom of the page, so the wall ends above it at every width (the
 * legend wraps onto more rows on a narrower screen). Null until measured; the stylesheet has a fallback.
 */
function useLegendHeight(root: RefObject<HTMLDivElement | null>): number | null {
  const [height, setHeight] = useState<number | null>(null);
  useEffect(() => {
    const host = root.current?.closest(".temple-app");
    const legend = host?.querySelector('[data-tour="legend"]');
    if (!host || !legend || typeof ResizeObserver === "undefined") return;
    const measure = () => setHeight(Math.max(0, Math.round(host.getBoundingClientRect().bottom - legend.getBoundingClientRect().top)));
    const observer = new ResizeObserver(measure);
    observer.observe(legend);
    observer.observe(host);
    return () => observer.disconnect();
  }, [root]);
  return height;
}

export function StandardsWallView({ data, focus, onFocus, panelOpen = true, onReady }: VisualProps) {
  const { payload, loaded } = useStandards();
  const marks = useMemo(() => marksFromPlans(data.plans), [data.plans]);
  const names = useMemo(() => (payload?.repos ?? []).map((r) => r.name), [payload]);
  const root = useRef<HTMLDivElement>(null);
  const legend = useLegendHeight(root);

  // A pick belongs to the focus it was made at. When the engine moves on (Esc, the side panel, the back button) the
  // pick lapses and the wall follows the engine again: the selected face is then the repo of the focused plan.
  const [picked, setPicked] = useState<{ repo: string; at: string } | null>(null);
  const at = focusKey(focus);
  const selected = picked && picked.at === at ? picked.repo : focus.level === "plan" ? (repoForPlan(names, marks, focus.slug) ?? null) : null;

  // The selected face stays in sight: the list under the wall takes room, and the engine can select a face that is
  // further down (a plan picked in the side panel).
  useEffect(() => {
    const box = root.current?.querySelector(".std-scroll");
    const face = selected ? box?.querySelector(".std-pick.on") : null;
    if (!box || !face) return;
    const b = box.getBoundingClientRect();
    const f = face.getBoundingClientRect();
    if (f.top < b.top) box.scrollTop -= b.top - f.top + 4;
    else if (f.bottom > b.bottom) box.scrollTop += f.bottom - b.bottom + 4;
  }, [selected]);

  const close = () => {
    setPicked(null);
    if (focus.level === "plan") onFocus({ level: "project" });
  };

  const pick = (repo: RepoStandards) => {
    if (repo.name === selected) return close();
    const mark = marks.get(repoKey(repo.name));
    if (!mark) return setPicked({ repo: repo.name, at });
    setPicked({ repo: repo.name, at: `plan/${mark.slug}` });
    onFocus({ level: "plan", slug: mark.slug });
  };

  const style = legend === null ? undefined : ({ "--std-legend": `${legend}px` } as CSSProperties);

  return (
    <div ref={root} className={panelOpen ? "std-view panel-open" : "std-view"} style={style}>
      <div className="std-body">
        <Wall payload={payload} loaded={loaded} marks={marks} selected={selected} onPick={pick} onClose={close} />
      </div>
      {/* ready once the first answer (or its failure) is on screen, so a tour never starts on an empty wall */}
      {loaded && <ViewReady onReady={onReady} />}
    </div>
  );
}
