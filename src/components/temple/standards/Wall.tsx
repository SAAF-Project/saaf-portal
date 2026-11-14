import type { RepoStandards, StandardsPayload } from "../../../lib/repo-standards";
import { stageOf } from "../stages";
import { repoKey, type RepoMark } from "./marks";
import { STANDARDS, tally } from "./standards";
import { clock } from "./StandardsView";
import { summarise, summaryNotes, summaryParts } from "./summary";

// The picture of the Standards view: a wall of faces, one per repo. A face is a 3x3 grid of tiles, one tile per
// standard, in the order of STANDARDS (row by row). Pure: it draws the payload and the selection it is given
// (WallView.tsx fetches and keeps the selection), so it can be rendered in a test. The styles are in wall.css.

type State = "in place" | "missing" | "not checked";

const STATES: State[] = ["in place", "missing", "not checked"];
const stateOf = (value: boolean | null | undefined): State => (value === true ? "in place" : value === false ? "missing" : "not checked");

/** Alphabetical, whatever the case, so a repo keeps its place on the wall all day. */
export const byName = (a: { name: string }, b: { name: string }): number => {
  const x = a.name.toLowerCase();
  const y = b.name.toLowerCase();
  return x < y ? -1 : x > y ? 1 : a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
};

function Tile({ state, label }: { state: State; label?: string }) {
  return <span className="std-tile" data-state={state} title={label ? `${label}: ${state}` : undefined} aria-hidden="true" />;
}

/** What a screen reader hears for a face: the states in words, shortest first. */
function spoken(repo: RepoStandards): string {
  const t = tally(repo.checks);
  if (t.complete) return `all ${t.total} standards in place`;
  const named = (state: State) => STANDARDS.filter((s) => stateOf(repo.checks[s.id]) === state).map((s) => s.label);
  const parts = [`${t.met} of ${t.total} standards in place`];
  if (t.missing) parts.push(`missing: ${named("missing").join(", ")}`);
  if (t.unknown) parts.push(`not checked: ${named("not checked").join(", ")}`);
  return parts.join("; ");
}

function Face({ repo, mark, selected, onPick }: { repo: RepoStandards; mark: RepoMark | undefined; selected: boolean; onPick: (repo: RepoStandards) => void }) {
  const t = tally(repo.checks);
  const stage = mark ? stageOf(mark) : null;
  return (
    <li className="std-cell" data-repo={repo.name} data-complete={t.complete ? "true" : undefined}>
      <button type="button" className={selected ? "std-pick on" : "std-pick"} aria-pressed={selected} onClick={() => onPick(repo)}>
        <span className="std-face" role="img" aria-label={spoken(repo)}>
          {STANDARDS.map((s) => (
            <Tile key={s.id} state={stateOf(repo.checks[s.id])} label={s.label} />
          ))}
        </span>
        <span className="std-name" title={repo.name}>
          {repo.name}
        </span>
        <span className="std-count">
          {stage && <i className="std-stage" style={{ background: stage.color }} title={`Linked to a plan in the stage ${stage.label}`} />}
          <span>
            {t.met}/{t.total}
          </span>
          {stage && <span className="std-sr">, linked to a plan in the stage {stage.label}</span>}
        </span>
      </button>
    </li>
  );
}

/** The key: what a tile looks like in each state, and which standard sits where on a face. */
function KeyBody() {
  return (
    <>
      <ul className="std-states" aria-label="What a tile says">
        {STATES.map((state) => (
          <li key={state}>
            <Tile state={state} /> {state}
          </li>
        ))}
        <li>
          <span className="std-ringkey" aria-hidden="true" /> all nine in place
        </li>
        <li>
          <i className="std-stage" style={{ background: "var(--muted)" }} aria-hidden="true" /> linked to a plan, in its stage colour
        </li>
      </ul>
      <ol className="std-keyface" aria-label="Which standard sits where on a face">
        {STANDARDS.map((s) => (
          <li key={s.id} title={s.file}>
            {s.label}
          </li>
        ))}
      </ol>
    </>
  );
}

function Detail({ repo, mark, onClose }: { repo: RepoStandards; mark: RepoMark | undefined; onClose: () => void }) {
  const t = tally(repo.checks);
  const stage = mark ? stageOf(mark) : null;
  const facts = [`${t.met} of ${t.total} in place`];
  if (t.unknown) facts.push(`${t.unknown} not checked`);
  return (
    <section className="std-detail" aria-label={`The nine standards of ${repo.name}`} data-selected={repo.name}>
      <div className="std-detail-head">
        <h2>
          {/* the engine and the portal both colour every link; a repo name reads calmer in the text colour */}
          <a href={repo.url} target="_blank" rel="noopener noreferrer" style={{ color: "inherit" }}>
            {repo.name}
          </a>
        </h2>
        <p className="std-facts">{facts.join(" · ")}</p>
        <p className="std-plan">
          {mark && stage ? (
            <>
              <i className="std-stage" style={{ background: stage.color }} aria-hidden="true" />
              Plan: {mark.title} · {stage.label}
            </>
          ) : (
            "No plan links to this repo."
          )}
        </p>
        <button type="button" className="std-close" onClick={onClose} aria-label="Close the nine standards of this repo">
          ✕
        </button>
      </div>
      <ol className="std-checks">
        {STANDARDS.map((s) => {
          const state = stateOf(repo.checks[s.id]);
          return (
            <li key={s.id} data-state={state} title={s.file}>
              <Tile state={state} />
              <span className="std-check-name">{s.label}</span>
              <span className="std-check-state">{state}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export interface WallProps {
  payload: StandardsPayload | null;
  loaded: boolean;
  /** The plan behind a repo, by repo key (marksFromPlans). */
  marks: Map<string, RepoMark>;
  /** The name of the selected repo, if any. */
  selected: string | null;
  onPick: (repo: RepoStandards) => void;
  onClose: () => void;
}

export function Wall({ payload, loaded, marks, selected, onPick, onClose }: WallProps) {
  if (!loaded) return <p className="std-note">Checking the repos.</p>;
  if (!payload || !payload.repos) {
    return <p className="std-note">The standards have no answer from GitHub right now. The picture tries again every minute.</p>;
  }

  const repos = [...payload.repos].sort(byName);
  const summary = summarise(repos);
  const parts = summaryParts(summary, payload.checked_at ? clock(payload.checked_at) : null);
  const notes = summaryNotes(summary, payload.archived);
  if (payload.stale) notes.push("GitHub did not answer the last check, so this may be behind");
  const open = repos.find((r) => r.name === selected);

  return (
    <>
      <header className="std-head">
        <div className="std-sum">
          <p className="std-line" aria-live="polite">
            {/* each part stays whole; on a narrow screen the line breaks after a dot, never inside a part */}
            {parts.map((part, i) => (
              <span key={part}>
                <span className="std-part">
                  {part}
                  {i < parts.length - 1 && <span className="std-sep"> ·</span>}
                </span>{" "}
              </span>
            ))}
          </p>
          <p className="std-notes">{notes.join(" · ")}</p>
        </div>
        <div className="std-key std-key-wide">
          <KeyBody />
        </div>
        <details className="std-key std-key-narrow">
          <summary>Key: what a tile says, and which standard sits where</summary>
          <KeyBody />
        </details>
      </header>

      <div className="std-scroll">
        <ul className="std-wall" aria-label="One face per repo, in alphabetical order">
          {repos.map((r) => (
            <Face key={r.name} repo={r} mark={marks.get(repoKey(r.name))} selected={r.name === selected} onPick={onPick} />
          ))}
        </ul>
      </div>

      {open && <Detail repo={open} mark={marks.get(repoKey(open.name))} onClose={onClose} />}
    </>
  );
}
