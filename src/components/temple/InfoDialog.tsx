import { useEffect, useRef } from "react";
import { ALERT_COLOR, SEVERITY_LABEL, severityRank } from "./alerts";
import { GlyphIcon } from "./GlyphIcon";
import { GLYPH_KINDS, KIND_LABEL } from "./glyphs";
import { LIVE_ALERT_CATALOG } from "./liveAlerts";
import { DISCLAIMER, type RelationEdge } from "./relations";
import { STAGES } from "./stages";
import type { ProgressData } from "./types";

const pct = (v: number) => `${Math.round(v * 100)}%`;

/** "How to read this": where the numbers come from and what they mean. Written from the data, so it cannot drift from it. */
export function InfoDialog({ data, about, viewTitle, relations = [], topic, onClose }: { data: ProgressData; about: string; viewTitle: string; relations?: RelationEdge[]; topic?: "relations"; onClose: () => void }) {
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

  return (
    <div className="info-backdrop" onClick={onClose}>
      <div className="info" role="dialog" aria-modal="true" aria-labelledby="info-title" onClick={(e) => e.stopPropagation()}>
        <header>
          <h2 id="info-title">How to read this</h2>
          <button ref={closeRef} onClick={onClose} aria-label="Close">✕</button>
        </header>

        <section>
          <h3>Where the information comes from</h3>
          <p>
            Every plan is a Markdown file in the <code>plans/</code> folder of the SAAF-Project repository. A script reads each file: its <b>PDCA table</b> (Plan, Do, Check, Act), the Status and Type rows, repo links and sector. Three curated lists fill the gaps the plans leave: sectors, which repo belongs to which plan, and a proposed track for plans outside the Hackathon #3 workstreams. {relations.length ? "Apart from the relations between plans (see below), nothing" : "Nothing"} in this picture is typed in by hand.
          </p>
          <p>
            The script runs again whenever a plan changes on the main branch, so the picture follows the plans.
            {data.generated && <> This data was generated on <b>{data.generated}</b>, for <b>{data.project.plan_count}</b> plans.</>}
          </p>
          <p>
            {liveChecks
              ? "The repo alerts (no AUDIT-CRITERIA.md, no tests, repo not found or archived, repo quiet) are checked live against GitHub, refreshed about every 10 minutes."
              : "The repo alerts that need GitHub (no AUDIT-CRITERIA.md, no tests, repo not found or archived, repo quiet) are not available in this view."}
          </p>
        </section>

        <section>
          <h3>What the percentages mean</h3>
          <ul>
            <li><b>A plan:</b> each of Plan, Do, Check and Act counts <b>complete = {w.complete}</b>, <b>in progress = {w.in_progress}</b>, <b>not started = {w.not_started}</b>; the plan&rsquo;s percentage is the average of the four. Plan complete and Do in progress, the rest not started, is ({w.complete} + {w.in_progress}) / 4 = {pct(example)}.</li>
            <li><b>A part or the whole project:</b> the average of its plans. A plan without a PDCA table is counted as a plan but left out of the average, because there is nothing to average.</li>
            <li><b>The Plan / Do / Check / Act bars:</b> the same average, per phase.</li>
            <li><b>The colour bands:</b> every plan covers the same surface of its part, so a colour&rsquo;s share of the surface is the share of plans in that stage. It counts plans; it does not weigh how big a plan is.</li>
            <li><b>Percentage versus stage:</b> the percentage is what the plan says about itself. The stage is what can be shown. An agent whose table says work has started, but that has no repo or code, stays in its plan stage, and an alert says so.</li>
          </ul>
        </section>

        <section>
          <h3>Stages, red to green</h3>
          <p className="hint">The same for every type of plan. The stage follows the PDCA table, but an agent only leaves the plan stages once a repo (or code) can be shown.</p>
          <ul className="legendlist">
            {STAGES.map((s) => (
              <li key={s.key}><i className="swatch" style={{ background: s.color }} /><b>{s.label}</b> {s.hint}</li>
            ))}
          </ul>
        </section>

        <section>
          <h3>Types</h3>
          <p className="chips">
            {GLYPH_KINDS.map((k) => (
              <span key={k} className="chip"><GlyphIcon kind={k} />{KIND_LABEL[k]}</span>
            ))}
          </p>
          <p className="hint">The type comes from the plan&rsquo;s Type row. The symbol shows on each piece once a part is opened.</p>
        </section>

        <section>
          <h3>Alerts and tags</h3>
          <p>An alert says something is worth a look. It is not a verdict on the plan. <b>Conflicts</b> (violet tag) and <b>warnings</b> (indigo tag) put a small tag on the piece; <b>notes</b> are listed in the side panel and can be filtered on, but get no tag, because some are true for most plans. A light tag in the other corner means the plan&rsquo;s place in the temple is a proposal.</p>
          <ul className="legendlist">
            {alerts.map((a) => (
              <li key={a.id}><i className="swatch tag" style={{ background: ALERT_COLOR[a.severity] }} /><b>{a.label}</b> <span className="hint">({SEVERITY_LABEL[a.severity].toLowerCase()})</span> {a.hint}</li>
            ))}
          </ul>
        </section>

        {relations.length > 0 && (
          <section ref={relationsRef}>
            <h3>Inputs and outputs between plans</h3>
            <p className="info-warning"><b>⚠ {DISCLAIMER.title}.</b> {DISCLAIMER.text}</p>
            <p>
              The plans hardly document which plan uses what another plan produces. The {relations.length} relations shown here were read by an AI from the plan texts: the &ldquo;Related SAAF plans&rdquo;, &ldquo;Dependencies&rdquo; and &ldquo;Feeds into&rdquo; lists and sentences such as &ldquo;consumes the RCM output&rdquo;. Plans that only say they are similar or parallel are left out. Each relation keeps the lines it was read from (hover a row in the side panel to see them). <b>{relations.filter((r) => r.status === "confirmed").length}</b> of them have been confirmed by a plan owner.
            </p>
            <p>To make this accurate, plan owners can:</p>
            <ul>
              <li>write down in their plan what it takes in and what it produces, and which plans those come from or go to;</li>
              <li>link those plans, and the repos that exchange the files (for example <code>rcm.json</code>);</li>
              <li>confirm, correct or remove the suggested relations for their plan (for now in <code>relations.json</code> in the saaf-progress-temple repository, until the owners decide where this list should live).</li>
            </ul>
          </section>
        )}

        <section>
          <h3>{viewTitle}</h3>
          <p>{about} Click a part to open it into its plans, click a plan for its details, Esc goes one level up. The switch in the header changes the visualisation; the numbers, filters and side panel stay the same.</p>
        </section>
      </div>
    </div>
  );
}
