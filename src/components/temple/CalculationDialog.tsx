import { useEffect, useRef } from "react";
import { ALERT_COLOR, SEVERITY_LABEL, severityRank } from "./alerts";
import { LIVE_ALERT_CATALOG } from "./liveAlerts";
import { DISCLAIMER, type RelationEdge } from "./relations";
import { ScoreDiagram } from "./ScoreDiagram";
import type { ProgressData } from "./types";
import type { ViewDefinition } from "./views";

const pct = (v: number) => `${Math.round(v * 100)}%`;

// Where the numbers are calculated. Both files carry a comment on every weight.
const SCORING_CODE = [
  { label: "averages (derive.ts)", href: "https://github.com/SAAF-Project/saaf-portal/blob/main/src/components/temple/derive.ts" },
  { label: "a plan's score and stage (generate_dashboard.py)", href: "https://github.com/SAAF-Project/SAAF-Project/blob/main/tools/scripts/generate_dashboard.py" },
];

type CalculationView = Pick<ViewDefinition, "title" | "calculation" | "supports">;

/**
 * "How this is calculated": a few lines per visualisation, a small diagram and a link to the scoring code. It says
 * nothing about the other views. Written from the data, so the numbers cannot drift from it. How to read a picture is
 * the job of the tour, not of this screen.
 */
export function CalculationDialog({ data, view, relations = [], topic, onClose }: { data: ProgressData; view: CalculationView; relations?: RelationEdge[]; topic?: "relations"; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const relationsRef = useRef<HTMLElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
    if (topic === "relations") relationsRef.current?.scrollIntoView({ block: "start" });
  }, [topic]);

  const w = data.weights;
  const liveChecks = data.alert_catalog.some((a) => LIVE_ALERT_CATALOG.some((l) => l.id === a.id));
  const alerts = [...data.alert_catalog].sort((a, b) => severityRank(b.severity) - severityRank(a.severity));
  const example = (w.complete + w.in_progress) / 4;
  const showRelations = view.supports.relations && relations.length > 0;

  return (
    <div className="info-backdrop" onClick={onClose}>
      <div className="info" role="dialog" aria-modal="true" aria-labelledby="info-title" onClick={(e) => e.stopPropagation()}>
        <header>
          <h2 id="info-title">How this is calculated</h2>
          <button ref={closeRef} onClick={onClose} aria-label="Close">✕</button>
        </header>
        <p className="hint">{view.title}</p>

        <section>
          <p>
            Each of a plan&rsquo;s four phases (Plan, Do, Check, Act) counts <b>complete = {w.complete}</b>, <b>in progress = {w.in_progress}</b> or <b>not started = {w.not_started}</b>. The plan&rsquo;s percentage is the average of the four: Plan complete and Do in progress, the rest not started, is ({w.complete} + {w.in_progress}) / 4 = {pct(example)}.
          </p>
          <ScoreDiagram weights={w} />
          <ul>
            <li>A block, and the whole project, shows the average of its plans. A plan without a PDCA table is counted as a plan but left out of the average.</li>
            <li>The percentage is what the plan says about itself. The stage is what can be shown: an agent that has started but has no repo or code stays in its plan stage, and an alert says so.</li>
            {view.calculation.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <p className="hint">
            The code: {SCORING_CODE.map((c, i) => (
              <span key={c.href}>{i > 0 && " and "}<a href={c.href} target="_blank" rel="noreferrer">{c.label}</a></span>
            ))}.
          </p>
        </section>

        <section>
          <h3>Where the data comes from</h3>
          <p>
            Every plan is a Markdown file in the <code>plans/</code> folder of the SAAF-Project repository; a script reads its PDCA table, Status and Type rows, repo links and sector, and runs again whenever a plan changes.
            {data.generated && <> This data was generated on <b>{data.generated}</b>, for <b>{data.project.plan_count}</b> plans.</>}{" "}
            {liveChecks
              ? "The repo alerts are checked live against GitHub, about every 10 minutes."
              : "The repo alerts that need GitHub are not available in this view."}
          </p>
        </section>

        {showRelations && (
          <section ref={relationsRef}>
            <h3>Inputs and outputs between plans</h3>
            <p className="info-warning"><b>⚠ {DISCLAIMER.title}.</b> {DISCLAIMER.text}</p>
            <p>
              An AI read the {relations.length} relations from the plan texts (&ldquo;Related SAAF plans&rdquo;, &ldquo;Dependencies&rdquo;, &ldquo;Feeds into&rdquo; and sentences such as &ldquo;consumes the RCM output&rdquo;). <b>{relations.filter((r) => r.status === "confirmed").length}</b> of them have been confirmed by a plan owner. Plan owners can write down what their plan takes in and produces, and confirm, correct or remove the suggestions for their plan (for now in <code>relations.json</code>).
            </p>
          </section>
        )}

        <section>
          <details>
            <summary>What the alerts mean</summary>
            <p>An alert says something is worth a look. It is not a verdict on the plan.</p>
            <ul className="legendlist">
              {alerts.map((a) => (
                <li key={a.id}><i className="swatch tag" style={{ background: ALERT_COLOR[a.severity] }} /><b>{a.label}</b> <span className="hint">({SEVERITY_LABEL[a.severity].toLowerCase()})</span> {a.hint}</li>
              ))}
            </ul>
          </details>
        </section>
      </div>
    </div>
  );
}
