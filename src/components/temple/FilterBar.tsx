import { ALERT_COLOR, severityRank } from "./alerts";
import { GlyphIcon } from "./GlyphIcon";
import { KIND_LABEL_PLURAL } from "./glyphs";
import { ATTENTION, NO_FILTERS, isActive, needsAttention, toggle, type Filters, type Submitter } from "./filters";
import { STAGES } from "./stages";
import type { AlertDefinition, PlanKind, PlanRecord } from "./types";
import type { ReactNode } from "react";

const KIND_ORDER: PlanKind[] = ["agent", "workflow", "skill", "document", "unspecified"];

interface ChipProps {
  label: string;
  count: number;
  active: boolean;
  swatch: ReactNode;
  onClick: () => void;
  title?: string;
}

function Chip({ label, count, active, swatch, onClick, title }: ChipProps) {
  return (
    <button className={`fchip${active ? " on" : ""}${count === 0 ? " empty" : ""}`} aria-pressed={active} onClick={onClick} title={title}>
      {swatch}
      {label}
      <span className="fcount">{count}</span>
    </button>
  );
}

const dot = (color: string) => <i className="swatch" style={{ background: color }} />;
const tag = (color: string) => <i className="swatch tag" style={{ background: color }} />;

interface FilterBarProps {
  plans: PlanRecord[];
  alertCatalog: AlertDefinition[];
  sectors: string[];
  submitters: Submitter[];
  filters: Filters;
  matchCount: number;
  onChange: (next: Filters) => void;
  rememberedOwner: string | null;
  identityName?: string | null; // signed-in person: the personal view is theirs, no picker
}

/** Filters on stage, type, alert and sector, plus the general / personal view. All counts are live. */
export function FilterBar({ plans, alertCatalog, sectors, submitters, filters, matchCount, onChange, rememberedOwner, identityName = null }: FilterBarProps) {
  const stageCount = (id: number) => plans.filter((p) => p.stage === id).length;
  const kindCount = (k: PlanKind) => plans.filter((p) => p.kind === k).length;
  const alertCount = (id: string) => plans.filter((p) => p.alerts.some((a) => a.id === id)).length;
  const sectorCount = (s: string) => plans.filter((p) => p.sectors.includes(s)).length;
  const attention = plans.filter(needsAttention).length;
  const owners = [...submitters].filter((s) => s.plans.length).sort((a, b) => b.plans.length - a.plans.length || a.name.localeCompare(b.name));
  const personal = filters.owner !== null;
  const alerts = alertCatalog
    .filter((a) => alertCount(a.id) > 0)
    .sort((a, b) => severityRank(b.severity) - severityRank(a.severity));

  return (
    <section className="filterbar" aria-label="Filters">
      <div className="fgroup">
        <span className="flabel">Stage</span>
        <div className="fchips">
          {STAGES.map((s) => (
            <Chip key={s.key} label={s.label} count={stageCount(s.id)} active={filters.stages.includes(s.id)} swatch={dot(s.color)} title={s.hint} onClick={() => onChange({ ...filters, stages: toggle(filters.stages, s.id) })} />
          ))}
        </div>
      </div>

      <div className="fgroup">
        <span className="flabel">Type</span>
        <div className="fchips">
          {KIND_ORDER.filter((k) => kindCount(k) > 0).map((k) => (
            <Chip key={k} label={KIND_LABEL_PLURAL[k]} count={kindCount(k)} active={filters.kinds.includes(k)} swatch={<GlyphIcon kind={k} />} onClick={() => onChange({ ...filters, kinds: toggle(filters.kinds, k) })} />
          ))}
        </div>
      </div>

      <div className="fgroup">
        <span className="flabel">Alerts</span>
        <div className="fchips">
          <Chip label="Needs attention" count={attention} active={filters.alerts.includes(ATTENTION)} swatch={tag(ALERT_COLOR.error)} title="At least one conflict or warning" onClick={() => onChange({ ...filters, alerts: toggle(filters.alerts, ATTENTION) })} />
          {alerts.map((a) => (
            <Chip key={a.id} label={a.label} count={alertCount(a.id)} active={filters.alerts.includes(a.id)} swatch={a.severity === "info" ? dot(ALERT_COLOR.info) : tag(ALERT_COLOR[a.severity])} title={a.hint} onClick={() => onChange({ ...filters, alerts: toggle(filters.alerts, a.id) })} />
          ))}
        </div>
      </div>

      <div className="fgroup">
        <span className="flabel">Sector</span>
        <div className="fchips">
          {sectors.filter((s) => sectorCount(s) > 0).map((s) => (
            <Chip key={s} label={s} count={sectorCount(s)} active={filters.sectors.includes(s)} swatch={dot("var(--accent)")} onClick={() => onChange({ ...filters, sectors: toggle(filters.sectors, s) })} />
          ))}
        </div>
      </div>

      <div className="fgroup">
        <span className="flabel">View</span>
        <div className="fchips">
          <div className="segmented" role="group" aria-label="View">
            <button className={!personal ? "on" : ""} aria-pressed={!personal} onClick={() => onChange({ ...filters, owner: null })}>General</button>
            <button className={personal ? "on" : ""} aria-pressed={personal} disabled={!identityName && !owners.length} onClick={() => onChange({ ...filters, owner: identityName ?? rememberedOwner ?? owners[0]?.name ?? null })}>Personal</button>
          </div>
          {personal && identityName && <span className="hint">your plans ({identityName})</span>}
          {personal && !identityName && (
            <select aria-label="Whose plans" value={filters.owner ?? ""} onChange={(e) => onChange({ ...filters, owner: e.target.value })}>
              {owners.map((o) => (
                <option key={o.name} value={o.name}>{o.name} ({o.plans.length})</option>
              ))}
            </select>
          )}
          {!identityName && !owners.length && <span className="hint">submitters.json not found: run npm run sync-data</span>}
        </div>
      </div>

      <div className="fresult">
        <b>{matchCount}</b> of {plans.length} plans match
        {isActive(filters) && <button onClick={() => onChange(NO_FILTERS)}>Clear filters</button>}
      </div>
    </section>
  );
}
