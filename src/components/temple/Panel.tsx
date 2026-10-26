import type { ReactNode } from "react";
import { PHASE_COLOR, REPO_COLOR, REPO_LABEL } from "./colors";
import { ALERT_COLOR, SEVERITY_LABEL, severityRank, tagSeverity } from "./alerts";
import { GlyphIcon } from "./GlyphIcon";
import { KIND_LABEL, KIND_LABEL_PLURAL } from "./glyphs";
import { DISCLAIMER, relationsOf, type RelationEdge } from "./relations";
import { STAGES, progressColor, stageCounts, stageOf } from "./stages";
import type { AlertDefinition, AnnexItem, Focus, PartRecord, PhaseKey, PlanKind, PlanRecord, ProgressData, RepoStatus, Rollup } from "./types";

const PHASES: { key: PhaseKey; label: string }[] = [
  { key: "plan", label: "Plan" },
  { key: "do", label: "Do" },
  { key: "check", label: "Check" },
  { key: "act", label: "Act" },
];
const KIND_ORDER: PlanKind[] = ["agent", "workflow", "skill", "document", "unspecified"];
const pct = (v: number | null) => (v === null ? "n/a" : `${Math.round(v * 100)}%`);
const share = (count: number, total: number) => (total ? `${Math.round((count / total) * 100)}%` : "0%");

function Bar({ value, color }: { value: number | null; color?: string }) {
  return (
    <span className="bar">
      <span className="bar-fill" style={{ width: `${(value ?? 0) * 100}%`, background: color ?? progressColor(value).getStyle() }} />
    </span>
  );
}

/** Stacked bar: how much of the surface sits in each stage, red (draft) to green (improving), left to right. */
function StageBar({ plans }: { plans: PlanRecord[] }) {
  const counts = stageCounts(plans);
  if (!plans.length) return <span className="stagebar" />;
  return (
    <span className="stagebar" title={counts.map((c) => `${c.stage.label}: ${c.count}`).join(", ")}>
      {counts.map(({ stage, count }) => (
        <span key={stage.key} style={{ width: `${(count / plans.length) * 100}%`, background: stage.color }} />
      ))}
    </span>
  );
}

/** Stage breakdown with the share of the surface per stage, red (draft) to green (improving). */
function StageBreakdown({ plans }: { plans: PlanRecord[] }) {
  const counts = new Map(stageCounts(plans).map((c) => [c.stage.id, c.count]));
  return (
    <div className="stages">
      <StageBar plans={plans} />
      {[...STAGES].reverse().map((s) => {
        const n = counts.get(s.id) ?? 0;
        return (
          <div key={s.key} className={n ? "stage-row" : "stage-row none"} title={s.hint}>
            <i style={{ background: s.color }} />
            <span className="stage-name">{s.label}</span>
            <span className="num">{n} · {share(n, plans.length)}</span>
          </div>
        );
      })}
    </div>
  );
}

function RepoBadge({ status }: { status: RepoStatus }) {
  return (
    <span className="badge" style={{ borderColor: REPO_COLOR[status], color: REPO_COLOR[status] }}>
      {REPO_LABEL[status]}
    </span>
  );
}

function Phases({ r }: { r: Rollup }) {
  return (
    <div className="phases">
      {PHASES.map(({ key, label }) => (
        <div key={key} className="phase-row">
          <span>{label}</span>
          <Bar value={r.phase_progress[key]} />
          <span className="num">{pct(r.phase_progress[key])}</span>
        </div>
      ))}
      {r.plans_unknown > 0 && <p className="hint">{r.plans_unknown} plan(s) without a PDCA table are not counted in these averages.</p>}
    </div>
  );
}

/** How many plans raise each alert, worst first. */
function AlertSummary({ plans, catalog }: { plans: PlanRecord[]; catalog: AlertDefinition[] }) {
  const rows = catalog
    .map((a) => ({ a, n: plans.filter((p) => p.alerts.some((x) => x.id === a.id)).length }))
    .filter((r) => r.n > 0)
    .sort((x, y) => severityRank(y.a.severity) - severityRank(x.a.severity) || y.n - x.n);
  if (!rows.length) return <p className="hint">No alerts.</p>;
  return (
    <div className="chips">
      {rows.map(({ a, n }) => (
        <span key={a.id} className="chip" title={a.hint} style={{ borderColor: a.severity === "info" ? undefined : ALERT_COLOR[a.severity] }}>
          <i style={{ background: ALERT_COLOR[a.severity] }} />
          {a.label} <b>{n}</b>
        </span>
      ))}
    </div>
  );
}

/** How many plans of each type (agent, workflow, skill, document). */
function KindSummary({ plans }: { plans: PlanRecord[] }) {
  return (
    <div className="chips">
      {KIND_ORDER.map((k) => ({ k, n: plans.filter((p) => p.kind === k).length }))
        .filter((r) => r.n > 0)
        .map(({ k, n }) => (
          <span key={k} className="chip">
            <GlyphIcon kind={k} />
            {n} {n === 1 ? KIND_LABEL[k].toLowerCase() : KIND_LABEL_PLURAL[k].toLowerCase()}
          </span>
        ))}
    </div>
  );
}

function PlanRow({ plan, onFocus, annex }: { plan: PlanRecord; onFocus: (f: Focus) => void; annex?: boolean }) {
  const stage = stageOf(plan);
  return (
    <button className="row" onClick={() => onFocus(annex ? { level: "annex", slug: plan.slug } : { level: "plan", slug: plan.slug })}>
      <i className="dot" style={{ background: stage.color }} title={stage.label} />
      <span className="row-glyph" title={KIND_LABEL[plan.kind]}><GlyphIcon kind={plan.kind} /></span>
      <span className="row-text">
        <span className="row-title">{plan.title || plan.slug}</span>
        <span className="row-slug">{plan.slug}</span>
      </span>
      {tagSeverity(plan) && <i className="alert-dot" style={{ background: ALERT_COLOR[tagSeverity(plan)!] }} title={plan.alerts.filter((a) => a.severity !== "info").map((a) => a.message).join(" ")} />}
      <span className="stage-chip" style={{ background: stage.color }}>{stage.label}</span>
    </button>
  );
}

function Steps({ steps }: { steps: string[] }) {
  return (
    <ol className="steps">
      {steps.map((s) => (
        <li key={s}>{s}</li>
      ))}
    </ol>
  );
}

function RepoLinks({ item }: { item: Pick<AnnexItem, "primary" | "duplicates" | "main_repo_code" | "note"> }) {
  return (
    <div className="repos">
      {item.primary && (
        <p>
          <b>Primary:</b> <a href={item.primary.url} target="_blank" rel="noreferrer">{item.primary.name}</a>
        </p>
      )}
      {item.duplicates.length > 0 && (
        <p>
          <b>Possible duplicates:</b>{" "}
          {item.duplicates.map((d) => (
            <a key={d.url} href={d.url} target="_blank" rel="noreferrer" className="mr">{d.name}</a>
          ))}
        </p>
      )}
      {item.main_repo_code.length > 0 && (
        <p>
          <b>Code in the main repo:</b>{" "}
          {item.main_repo_code.map((c) => (
            <a key={c.url} href={c.url} target="_blank" rel="noreferrer" className="mr">{c.path}</a>
          ))}
        </p>
      )}
      {item.note && <p className="hint">{item.note}</p>}
    </div>
  );
}

/** What a plan gets from other plans and what it gives them, as links to those plans. */
function InputsOutputs({ slug, relations, plans, open, onFocus }: { slug: string; relations: RelationEdge[]; plans: Map<string, PlanRecord>; open: boolean; onFocus: (f: Focus) => void }) {
  const { inputs, outputs } = relationsOf(slug, relations);
  const suggested = [...inputs, ...outputs].some((e) => e.status === "suggested");
  const row = (e: RelationEdge, dir: "in" | "out") => {
    const other = plans.get(dir === "in" ? e.from : e.to);
    if (!other) return null;
    const verb = dir === "in" ? "Gets" : "Feeds";
    const prep = dir === "in" ? "from" : "to";
    return (
      <button key={`${dir}-${other.slug}`} className="row io-row" onClick={() => onFocus({ level: "plan", slug: other.slug })} title={e.sources.map((s) => `${s.file}${s.line ? `:${s.line}` : ""}: “${s.quote}”`).join("\n")}>
        <i className="dot" style={{ background: stageOf(other).color }} />
        <span className="row-text">
          <span className="io-line">
            {verb} {e.what ? <i>{e.what}</i> : "something"} {prep}
          </span>
          <span className="row-title">{other.title || other.slug}</span>
        </span>
        {e.status === "suggested" && <span className="tag">suggested</span>}
      </button>
    );
  };
  return (
    <Section title="Inputs and outputs" meta={`${inputs.length} in · ${outputs.length} out`} open={open}>
      {inputs.length + outputs.length === 0 ? (
        <p className="hint">No documented inputs or outputs.</p>
      ) : (
        <>
          {inputs.map((e) => row(e, "in"))}
          {outputs.map((e) => row(e, "out"))}
          {suggested && <p className="hint io-disclaimer">⚠ {DISCLAIMER.panel}</p>}
        </>
      )}
    </Section>
  );
}

interface PanelProps {
  data: ProgressData;
  focus: Focus;
  matches: (plan: PlanRecord) => boolean;
  filtersActive: boolean;
  onFocus: (f: Focus) => void;
  title: string; // what the whole picture is called
  onInfo: () => void; // opens the "How to read this" screen
  onHide: () => void; // folds the panel away, to see the whole temple
  relations?: RelationEdge[]; // which plan feeds which; without it the "Inputs and outputs" section is left out
  relationsOpen?: boolean; // open that section (in the dependency view)
}

/** A collapsible block. Only what matters at the current level is open; the rest is one click away. */
function Section({ title, meta, open = false, children }: { title: string; meta?: string; open?: boolean; children: ReactNode }) {
  return (
    <details className="sec" open={open}>
      <summary>
        <span className="sec-title">{title}</span>
        {meta && <span className="sec-meta">{meta}</span>}
      </summary>
      <div className="sec-body">{children}</div>
    </details>
  );
}

/** Where you are: a way back up, what kind of thing this is, its name. */
function Head({ kicker, title, sub, back, onHide }: { kicker: ReactNode; title: string; sub?: ReactNode; back?: { label: string; go: () => void }; onHide: () => void }) {
  return (
    <header className="phead">
      <div className="phead-top">
        {back ? <button className="back" onClick={back.go}>← {back.label}</button> : <span className="kicker">{kicker}</span>}
        <button className="hide" onClick={onHide} aria-label="Hide the side panel" title="Hide the side panel to see the whole temple">Hide ›</button>
      </div>
      {back && <span className="kicker">{kicker}</span>}
      <h2>{title}</h2>
      {sub && <p className="sub">{sub}</p>}
    </header>
  );
}

/** The headline number, and what it is the number of. */
function Stat({ value, label, onInfo }: { value: string; label: ReactNode; onInfo: () => void }) {
  return (
    <div className="stat">
      <span className="big">{value}</span>
      <span className="stat-text">
        {label}
        <button className="linkish" onClick={onInfo}>How is this calculated?</button>
      </span>
    </div>
  );
}

const PART_KICKER: Record<string, string> = { foundation: "Foundation", pillar: "Pillar", roof: "Roof" };
const attention = (plans: PlanRecord[]) => plans.some((p) => p.alerts.some((a) => a.severity !== "info"));

export function Panel({ data, focus, matches, filtersActive, onFocus, title, onInfo, onHide, relations, relationsOpen = false }: PanelProps) {
  const plans = new Map(data.plans.map((p) => [p.slug, p]));
  const guidance = data.annex.guidance;
  const plansOf = (part: PartRecord) => part.plans.map((s) => plans.get(s)).filter((p): p is PlanRecord => !!p);
  const treePlans = data.parts.filter((p) => p.kind !== "annex").flatMap(plansOf);
  const shown = (part: PartRecord) => plansOf(part).filter(matches);
  const matchLine = (n: number, total: number) =>
    filtersActive ? <p className="match-line">{n} of {total} plans match the filters.</p> : null;
  const key = focus.level === "part" ? `part-${focus.partId}` : focus.level === "plan" ? `plan-${focus.slug}` : focus.level === "annex" ? `annex-${focus.slug ?? ""}` : "project";
  const toProject = { label: title, go: () => onFocus({ level: "project" }) };

  if (focus.level === "project") {
    const p = data.project;
    const inView = filtersActive ? treePlans.filter(matches) : treePlans;
    return (
      <aside className="panel" key={key}>
        <Head kicker="Project overview" title={title} sub="Shared Audit Agents Framework" onHide={onHide} />
        <Stat value={pct(p.progress)} label={<>average progress over {p.plan_count} plans</>} onInfo={onInfo} />
        {matchLine(treePlans.filter(matches).length, treePlans.length)}
        <Section title={filtersActive ? "Stages (matching plans)" : "Stages"} open>
          <StageBreakdown plans={inView} />
        </Section>
        <Section title="Where the work sits" open>
          {data.parts.filter((x) => x.plan_count > 0).map((part) => (
            <button key={part.id} className="row" onClick={() => onFocus(part.kind === "annex" ? { level: "annex" } : { level: "part", partId: part.id })}>
              <span className="row-title">{part.stage ?? part.name}</span>
              <StageBar plans={shown(part)} />
              <span className="num">{filtersActive ? `${shown(part).length}/${part.plan_count}` : pct(part.progress)}</span>
            </button>
          ))}
        </Section>
        <Section title="Alerts" open={attention(inView)}>
          <AlertSummary plans={inView} catalog={data.alert_catalog} />
        </Section>
        <Section title="Types">
          <KindSummary plans={inView} />
        </Section>
        <Section title="Phases">
          <Phases r={p} />
        </Section>
      </aside>
    );
  }

  if (focus.level === "part") {
    const part: PartRecord | undefined = data.parts.find((x) => x.id === focus.partId);
    if (!part) return null;
    const members = shown(part).sort((a, b) => stageOf(b).id - stageOf(a).id || b.progress - a.progress);
    return (
      <aside className="panel" key={key}>
        <Head
          back={toProject}
          kicker={`${PART_KICKER[part.kind] ?? "Part"}${part.track !== null ? ` · Track ${part.track}` : ""}`}
          title={part.stage ?? part.name}
          sub={part.stage ? part.name : undefined}
          onHide={onHide}
        />
        <Stat value={pct(part.progress)} label={<>average progress over {part.plan_count} plans</>} onInfo={onInfo} />
        <p className="mission">{part.mission}</p>
        {matchLine(members.length, part.plan_count)}
        <Section title="Stages" open>
          <StageBreakdown plans={members} />
        </Section>
        <Section title="Plans" meta={filtersActive ? `${members.length} of ${part.plan_count}` : String(part.plan_count)} open>
          {members.map((plan) => (
            <PlanRow key={plan.slug} plan={plan} onFocus={onFocus} />
          ))}
        </Section>
        <Section title="Alerts" open={attention(members)}>
          <AlertSummary plans={members} catalog={data.alert_catalog} />
        </Section>
        <Section title="Types">
          <KindSummary plans={members} />
        </Section>
        <Section title="Phases">
          <Phases r={part} />
        </Section>
      </aside>
    );
  }

  if (focus.level === "plan") {
    const plan = plans.get(focus.slug);
    if (!plan) return null;
    const stage = stageOf(plan);
    const part = data.parts.find((x) => x.id === plan.part);
    const inAnnex = data.annex.items.some((i) => i.plan === plan.slug);
    const alerts = [...plan.alerts].sort((a, b) => severityRank(b.severity) - severityRank(a.severity));
    const repoIssue = plan.alerts.some((a) => a.id.includes("repo"));
    return (
      <aside className="panel" key={key}>
        <Head
          back={{ label: part?.stage ?? part?.name ?? "Back", go: () => onFocus(part ? { level: "part", partId: part.id } : { level: "project" }) }}
          kicker={<span className="kind-line"><GlyphIcon kind={plan.kind} /> {KIND_LABEL[plan.kind]}</span>}
          title={plan.title || plan.slug}
          sub={`${plan.session} · ${plan.status}`}
          onHide={onHide}
        />
        <div className="stat plan-stat">
          <span className="big">{plan.pdca_known ? pct(plan.progress) : "n/a"}</span>
          <span className="stat-text">
            <span className="stage-chip" style={{ background: stage.color }}>{stage.label}</span>
            <span className="hint">{stage.hint}</span>
            <button className="linkish" onClick={onInfo}>How is this calculated?</button>
          </span>
        </div>
        <div className="pdca-strip">
          {PHASES.map(({ key: phase, label }) => (
            <div key={phase}>
              <span className="lbl">{label}</span>
              <span className="phase-pill" style={{ background: plan.pdca_known ? PHASE_COLOR[plan.pdca[phase]] : "#8b94a5" }}>
                {plan.pdca_known ? plan.pdca[phase].replace("_", " ") : "unknown"}
              </span>
            </div>
          ))}
        </div>
        {alerts.length === 0 ? (
          <p className="hint ok-line">✓ No alerts</p>
        ) : (
          <Section title="Alerts" meta={String(alerts.length)} open>
            {alerts.map((a) => (
              <div key={a.id} className="alert-row" title={data.alert_catalog.find((d) => d.id === a.id)?.hint}>
                <span className="alert-sev" style={{ background: ALERT_COLOR[a.severity] }}>{SEVERITY_LABEL[a.severity]}</span>
                <span>{a.message}</span>
              </div>
            ))}
          </Section>
        )}
        {relations && <InputsOutputs slug={plan.slug} relations={relations} plans={plans} open={relationsOpen} onFocus={onFocus} />}
        <Section title="What it is about" open>
          <p>{plan.problem_summary || "No summary."}</p>
        </Section>
        {(plan.kind === "agent" || plan.repo || plan.main_repo_code.length > 0) && (
          <Section title="Repository" meta={REPO_LABEL[plan.repo_status]} open={repoIssue}>
            <RepoBadge status={plan.repo_status} />
            <RepoLinks item={{ primary: plan.repo, duplicates: plan.repo_alternatives, main_repo_code: plan.main_repo_code, note: plan.repo_note }} />
            {plan.alerts.some((a) => a.id === "claims-building-no-repo") && (
              <>
                <h4>{guidance.missing.title}</h4>
                <Steps steps={guidance.missing.steps} />
              </>
            )}
            {inAnnex && (
              <button className="link-btn" onClick={() => onFocus({ level: "annex", slug: plan.slug })}>
                Show in the Repo Annex: how to move or change this repo
              </button>
            )}
          </Section>
        )}
        <Section title="Placement" meta={`Track ${plan.track ?? "none"}`}>
          <p>
            Track {plan.track ?? "none"} ({plan.track_source}
            {plan.track_reason ? `: ${plan.track_reason}` : ""})
          </p>
          <div className="chips">
            {plan.sectors.map((s) => (
              <span key={s} className="chip">{s}</span>
            ))}
            <span className="hint">({plan.sector_source})</span>
          </div>
        </Section>
        <p className="plan-link">
          <a href={plan.github_url} target="_blank" rel="noreferrer">Open the plan on GitHub ↗</a>
        </p>
      </aside>
    );
  }

  // annex
  const annexPart = data.parts.find((p) => p.id === "annex");
  const annexPlans = annexPart ? plansOf(annexPart) : [];
  const selected = focus.slug ? data.annex.items.find((i) => i.plan === focus.slug) : undefined;

  if (selected) {
    const plan = plans.get(selected.plan);
    const stage = plan ? stageOf(plan) : undefined;
    return (
      <aside className="panel" key={key}>
        <Head
          back={{ label: data.annex.name, go: () => onFocus({ level: "annex" }) }}
          kicker="Repo Annex"
          title={selected.title || selected.plan}
          sub={stage && <span className="stage-chip" style={{ background: stage.color }}>{stage.label}</span>}
          onHide={onHide}
        />
        <Section title="Repositories" meta={REPO_LABEL[selected.status]} open>
          <RepoLinks item={selected} />
        </Section>
        {relations && <InputsOutputs slug={selected.plan} relations={relations} plans={plans} open={relationsOpen} onFocus={onFocus} />}
        {(selected.status === "duplicate" || selected.status === "main-repo") && (
          <Section title={`${guidance[selected.status].title}: how to move or change`} open>
            <Steps steps={guidance[selected.status].steps} />
            <p className="hint">
              Mapping file: <code>{guidance.config.mapping_file}</code>, or {guidance.config.plan_row}. {guidance.config.refresh}
            </p>
          </Section>
        )}
        <button className="link-btn" onClick={() => onFocus({ level: "plan", slug: selected.plan })}>
          Go to the plan in the temple
        </button>
      </aside>
    );
  }

  return (
    <aside className="panel" key={key}>
      <Head back={toProject} kicker="Side building" title={data.annex.name} onHide={onHide} />
      <Stat value={pct(annexPart?.progress ?? null)} label={<>average progress over {annexPlans.length} plans</>} onInfo={onInfo} />
      <p className="mission">Plans whose repository needs attention: possible duplicate repos, and agents built inside the main repository that should move to their own repo.</p>
      {matchLine(annexPlans.filter(matches).length, annexPlans.length)}
      <Section title="Stages" open>
        <StageBreakdown plans={annexPlans.filter(matches)} />
      </Section>
      <Section title="Plans" meta={filtersActive ? `${annexPlans.filter(matches).length} of ${data.annex.items.length}` : String(data.annex.items.length)} open>
        {data.annex.items.filter((item) => { const plan = plans.get(item.plan); return plan && matches(plan); }).map((item) => {
          const plan = plans.get(item.plan);
          const stage = plan ? stageOf(plan) : undefined;
          return (
            <button key={item.plan} className="row" onClick={() => onFocus({ level: "annex", slug: item.plan })}>
              <i className="dot" style={{ background: stage?.color }} title={stage?.label} />
              <span className="row-text">
                <span className="row-title">{item.title || item.plan}</span>
                <span className="row-slug">{item.plan}</span>
              </span>
              <RepoBadge status={item.status} />
            </button>
          );
        })}
        <p className="hint">Select a plan to see its repos and what to do.</p>
      </Section>
    </aside>
  );
}
