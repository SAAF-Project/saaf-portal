import type { StandardsPayload } from "../../../lib/repo-standards";
import { STANDARDS, tally } from "./standards";
import { summarise, summaryNotes, summaryParts } from "./summary";

// The live part of the standards board: the summary line and the table of repos by the nine standards.
// Pure: it draws the payload it is given (StandardsBoard.tsx fetches it), so it can be rendered in a test.

type State = "in place" | "missing" | "not checked";

const stateOf = (value: boolean | null | undefined): State => (value === true ? "in place" : value === false ? "missing" : "not checked");

const MARK: Record<State, string> = {
  "in place": "bg-accent border-accent",
  missing: "border-muted",
  "not checked": "border-dashed border-muted",
};

function Mark({ state, label }: { state: State; label?: string }) {
  const text = label ? `${label}: ${state}` : state;
  return (
    <span
      role="img"
      aria-label={text}
      title={text}
      data-state={state}
      className={`inline-block align-middle w-3.5 h-3.5 sm:w-5 sm:h-5 rounded-[3px] border-2 ${MARK[state]}`}
    />
  );
}

/** The time of day of an ISO timestamp, in the viewer's own time zone: "14:32". */
export const clock = (iso: string): string => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

export default function StandardsView({ payload, loaded }: { payload: StandardsPayload | null; loaded: boolean }) {
  if (!loaded) return <p className="text-muted">Checking the repos.</p>;
  if (!payload || !payload.repos) {
    return <p className="text-muted">The board has no answer from GitHub right now. It tries again every minute.</p>;
  }

  const repos = payload.repos;
  const summary = summarise(repos);
  const parts = summaryParts(summary, payload.checked_at ? clock(payload.checked_at) : null);
  const notes = summaryNotes(summary, payload.archived);
  if (payload.stale) notes.push("GitHub did not answer the last check, so this may be behind");

  return (
    <>
      <p className="text-2xl sm:text-3xl lg:text-4xl font-medium leading-tight tabular-nums mb-2" aria-live="polite">
        {/* each part stays whole; on a narrow screen the line breaks after a dot, never inside a part */}
        {parts.map((part, i) => (
          <span key={part}>
            <span className="whitespace-nowrap">
              {part}
              {i < parts.length - 1 && <span className="text-muted"> ·</span>}
            </span>{" "}
          </span>
        ))}
      </p>
      <p className="text-sm text-muted mb-6">{notes.join(" · ")}</p>

      <ul className="flex flex-wrap gap-x-5 gap-y-1 text-xs font-mono text-muted mb-2" aria-label="Key">
        {(["in place", "missing", "not checked"] as State[]).map((state) => (
          <li key={state} className="flex items-center gap-2">
            <Mark state={state} /> {state}
          </li>
        ))}
      </ul>
      <ol className="xl:hidden flex flex-wrap gap-x-4 gap-y-1 text-xs font-mono text-muted mb-3" aria-label="The nine standards">
        {STANDARDS.map((s, i) => (
          <li key={s.id}>
            {i + 1} {s.label}
          </li>
        ))}
      </ol>

      <table className="w-full table-fixed border-collapse text-[13px] sm:text-sm">
        <thead>
          <tr>
            <th scope="col" className="sticky top-0 z-10 bg-bg border-b border-border text-left align-top font-mono text-xs font-normal text-muted py-2">
              Repo
            </th>
            {STANDARDS.map((s, i) => (
              <th
                key={s.id}
                scope="col"
                title={s.label}
                className="sticky top-0 z-10 bg-bg border-b border-border w-5 sm:w-9 xl:w-[8%] text-center align-top font-mono text-xs font-normal text-muted py-2"
              >
                {i + 1}
                <span className="hidden xl:block text-[11px] leading-tight mt-0.5">{s.label}</span>
              </th>
            ))}
            <th scope="col" className="hidden sm:table-cell sticky top-0 z-10 bg-bg border-b border-border w-12 text-right align-top font-mono text-xs font-normal text-muted py-2">
              Met
            </th>
          </tr>
        </thead>
        <tbody>
          {repos.map((r) => {
            const t = tally(r.checks);
            return (
              <tr key={r.name} className={`border-b border-border ${t.complete ? "bg-accent/10" : ""}`} data-complete={t.complete ? "true" : undefined}>
                <th scope="row" className="text-left font-medium py-2 pr-2 [overflow-wrap:anywhere]">
                  {/* the global link colour would turn every row accent; a name reads calmer in the text colour */}
                  <a href={r.url} target="_blank" rel="noopener noreferrer" style={{ color: "inherit" }}>
                    {r.name}
                  </a>
                  {t.complete && <span className="block sm:inline sm:ml-2 font-mono text-xs font-normal text-accent">complete</span>}
                </th>
                {STANDARDS.map((s) => (
                  <td key={s.id} className="text-center py-2">
                    <Mark state={stateOf(r.checks[s.id])} label={s.label} />
                  </td>
                ))}
                <td className="hidden sm:table-cell text-right font-mono tabular-nums text-muted py-2">
                  {t.met}/{t.total}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </>
  );
}
