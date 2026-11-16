import type { FeedItem } from "../../../lib/leaderboard";
import type { LeaderboardPayload, PersonRow, ProposalRow, RepoRow } from "../../../lib/leaderboard-day";
import { STANDARDS } from "./standards";
import { clock } from "./StandardsView";

// The day's leaderboard above the standards board: best agent large, then most improved, top contributor (who added
// what, per person) and the live feed, with the rules. Pure: it draws the payload it is given (StandardsBoard.tsx
// fetches it), so it can be rendered in a test. The scores come from a review agent that grades the content of every
// standard (src/lib/leaderboard.ts); from 15:15 the top places are hidden until the organisers reveal them.

const LABEL: Record<string, string> = Object.fromEntries(STANDARDS.map((s) => [s.id, s.label]));
const SCORED = ["readme", "agent-yaml", "audit-criteria", "tests", "ci", "dependencies", "licence", "codeowners"];
const MAX: Record<string, number> = { readme: 3, "agent-yaml": 3, "audit-criteria": 3, tests: 3, ci: 3, dependencies: 2, licence: 1, codeowners: 1 };

export const RULES: string[] = [
  "Improve an agent repo. A standard counts once it lands on the default branch between 09:00 and 16:15. Open your last pull request by 16:00, so it can be merged in time.",
  "A review agent scores the content of every standard at 13:30, 15:00 and 16:15. It must quote your files as evidence; a level without a real quote does not stand.",
  "Points rise with each level and the last step counts most: one README taken to level 3 beats four READMEs at level 1.",
  "You get the points you add: the rise of a level, by as much as it still stands at 16:15. Improving someone else's file counts for what you improved; removing a file and putting it back counts for nothing.",
  "Licence, dependencies, CODEOWNERS and CI count for at most 6 points per person, so copying them into many repos does not win.",
  "Copied, empty or nonsense files score 0. Text that tries to steer the review agent disqualifies you.",
  "SECURITY.md is arranged by Stichting SAAF for every repo and counts for nobody.",
  "A merged pull request counts for its author, a direct push for whoever pushed. Bots do not count. Times are GitHub's own; a tie goes to whoever got there first.",
  "From 15:15 the top places are hidden. The result is revealed at the prize-giving, after the demos.",
  "Better standards are a track of their own: open a pull request with the label standard-proposal on agent-template or on docs/conventions in SAAF-Project. Nothing is merged today; a review checks whether it adds real value without making things more complicated.",
  "A new standard needs a strong case: why it does not fit in one of the nine, evidence from two repos, a rule the board can check, and which standard it replaces.",
  "You merge in your own repos. For someone else's repo, ask the creator and request write access below the board.",
];

function Avatar({ login, size = 28 }: { login: string; size?: number }) {
  if (login === "?") return <span className="inline-block rounded-md bg-surface2 shrink-0" style={{ width: size, height: size }} />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={`https://github.com/${encodeURIComponent(login)}.png?size=${size * 2}`} alt="" width={size} height={size} loading="lazy" className="rounded-md bg-surface2 shrink-0" style={{ width: size, height: size }} />
  );
}

/** The eight scored standards of a repo as small bars: how far each one is. */
function Levels({ levels, onPanel = false }: { levels: Record<string, number | undefined>; onPanel?: boolean }) {
  return (
    <ul className="grid grid-cols-4 gap-1.5 w-[184px] shrink-0" aria-label="Levels per standard">
      {SCORED.map((id) => {
        const lv = levels[id] ?? 0;
        return (
          <li key={id} title={`${LABEL[id] ?? id}: ${lv} of ${MAX[id]}`} className="flex gap-[2px] h-3">
            {Array.from({ length: MAX[id] }, (_, i) => (
              <span
                key={i}
                className={`flex-1 rounded-[2px] ${i < lv ? "std-glow" : onPanel ? "bg-[color-mix(in_srgb,var(--on-panel)_18%,transparent)]" : "bg-border"}`}
              />
            ))}
          </li>
        );
      })}
    </ul>
  );
}

function Hidden({ label }: { label: string }) {
  return <span className="font-mono text-muted">? · {label}</span>;
}

function BestAgent({ p }: { p: LeaderboardPayload }) {
  const [lead, ...rest] = p.best_agent;
  const final = p.phase === "after" && (!p.reveal || p.reveal.step >= p.reveal.total) && !p.frozen;
  return (
    <div className="rounded-2xl p-6 sm:p-8 mb-8" style={{ background: "var(--panel)", color: "var(--on-panel)" }}>
      <div className="grid gap-6 md:grid-cols-[1fr_auto] items-center">
        <div className="min-w-0">
          <p className="font-mono text-xs opacity-70 mb-3">Best agent · highest score at 16:15{final ? " · winner" : ""}</p>
          {!lead ? (
            <p className="text-3xl sm:text-4xl font-medium leading-tight">No agent has gained enough yet.</p>
          ) : lead.masked ? (
            <>
              <p className="text-5xl sm:text-6xl font-medium leading-none">?</p>
              <p className="mt-3 text-base opacity-80">Revealed at the prize-giving.</p>
            </>
          ) : (
            <div key={lead.name} className="reveal-once">
              <a href={lead.url} target="_blank" rel="noopener noreferrer" style={{ color: "inherit" }} className="block text-4xl sm:text-5xl font-medium leading-[1.05] [overflow-wrap:anywhere]">
                {lead.name}
              </a>
              <p className="mt-3 text-base opacity-80">
                <span className="font-mono">{lead.after}</span> points · +{lead.gain} today
              </p>
              {lead.by.length > 0 && (
                <ul className="flex flex-wrap gap-x-4 gap-y-2 mt-4">
                  {lead.by.map((l) => (
                    <li key={l} className="flex items-center gap-2 text-sm font-mono">
                      <Avatar login={l} />@{l}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
        {lead && !lead.masked && <Levels levels={lead.levels} onPanel />}
      </div>
      {rest.length > 0 && (
        <ol className="mt-6 border-t border-[color-mix(in_srgb,var(--on-panel)_16%,transparent)]">
          {rest.map((r, i) => (
            <li key={`${r.name}-${i}`} className="flex items-baseline gap-4 py-2 border-b border-[color-mix(in_srgb,var(--on-panel)_16%,transparent)] text-sm">
              <span className="font-mono text-xs opacity-60">{String(i + 2).padStart(2, "0")}</span>
              <span className="font-medium flex-1 min-w-0 [overflow-wrap:anywhere]">{r.masked ? "?" : r.name}</span>
              <span className="font-mono tabular-nums opacity-80">{r.masked ? "" : `${r.after} pts`}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function Improved({ rows }: { rows: RepoRow[] }) {
  if (rows.length === 0) return <p className="text-sm text-muted py-3 border-t border-border">No repo has gained points yet.</p>;
  return (
    <ol className="border-t border-border">
      {rows.map((r, i) => (
        <li key={`${r.name}-${i}`} className="grid grid-cols-[1.5rem_1fr_auto] gap-x-4 items-center py-3 border-b border-border">
          <span className="font-mono text-xs text-muted">{String(i + 1).padStart(2, "0")}</span>
          {r.masked ? (
            <Hidden label="revealed at the prize-giving" />
          ) : (
            <span className="min-w-0 reveal-once">
              <a href={r.url} target="_blank" rel="noopener noreferrer" style={{ color: "inherit" }} className="font-medium [overflow-wrap:anywhere]">
                {r.name}
              </a>
              {r.by.length > 0 && <span className="block text-xs font-mono text-muted [overflow-wrap:anywhere]">{r.by.map((l) => `@${l}`).join(" · ")}</span>}
            </span>
          )}
          <span className="text-right">
            {!r.masked && (
              <>
                <span className="block text-2xl font-medium tabular-nums leading-none">+{r.gain}</span>
                <span className="block text-xs font-mono text-muted mt-1">
                  {r.before} → {r.after}
                </span>
              </>
            )}
          </span>
        </li>
      ))}
    </ol>
  );
}

function People({ rows }: { rows: PersonRow[] }) {
  if (rows.length === 0) return <p className="text-sm text-muted py-3 border-t border-border">Nobody has added points yet.</p>;
  return (
    <ol className="border-t border-border">
      {rows.map((p, i) =>
        p.masked ? (
          <li key={`masked-${i}`} className="grid grid-cols-[1.5rem_auto_1fr] gap-x-3 items-center py-3 border-b border-border">
            <span className="font-mono text-xs text-muted">{String(i + 1).padStart(2, "0")}</span>
            <Avatar login="?" size={32} />
            <Hidden label="revealed at the prize-giving" />
          </li>
        ) : (
          <li key={p.login} className="border-b border-border reveal-once">
            <details className="group">
              <summary className="grid grid-cols-[1.5rem_auto_1fr_auto] gap-x-3 items-center py-3 cursor-pointer list-none">
                <span className="font-mono text-xs text-muted">{String(i + 1).padStart(2, "0")}</span>
                <Avatar login={p.login} size={32} />
                <span className="min-w-0">
                  <span className="block font-medium [overflow-wrap:anywhere]">@{p.login}</span>
                  <span className="block text-xs font-mono text-muted">
                    in {p.repos.length} {p.repos.length === 1 ? "repo" : "repos"} · <span className="group-open:hidden">show what</span>
                    <span className="hidden group-open:inline">hide</span>
                  </span>
                </span>
                <span className="text-2xl font-medium tabular-nums leading-none">{p.points}</span>
              </summary>
              <ul className="mb-3 ml-[calc(1.5rem+0.75rem)] text-xs font-mono text-muted">
                {p.contributions.map((c, j) => (
                  <li key={j} className="grid grid-cols-[3rem_1fr_auto] gap-x-3 py-1 border-t border-border">
                    <span>{clock(c.at)}</span>
                    <span className="[overflow-wrap:anywhere]">
                      {c.repo} · {LABEL[c.standard] ?? c.standard} {c.from} → {c.to}
                      {c.url && (
                        <>
                          {" · "}
                          <a href={c.url} target="_blank" rel="noopener noreferrer" className="text-accent">
                            PR
                          </a>
                        </>
                      )}
                    </span>
                    <span className="tabular-nums">+{c.points}</span>
                  </li>
                ))}
                {p.capped > 0 && <li className="py-1 border-t border-border">{p.capped} points from licence, dependencies, CODEOWNERS and CI fell above the cap of 6.</li>}
              </ul>
            </details>
          </li>
        ),
      )}
    </ol>
  );
}

function Feed({ items, frozen }: { items: FeedItem[]; frozen: boolean }) {
  if (items.length === 0) return <p className="text-sm text-muted py-3 border-t border-border">Nothing has landed yet.</p>;
  return (
    <ol className="border-t border-border text-sm max-h-[420px] overflow-y-auto">
      {items.map((f, i) => (
        <li key={`${f.at}-${f.repo}-${i}`} className="grid grid-cols-[3rem_1fr] gap-x-3 py-2 border-b border-border">
          <span className="font-mono text-xs text-muted pt-0.5">{clock(f.at)}</span>
          <span className="min-w-0 [overflow-wrap:anywhere]">
            {f.login ? <span className="font-mono">@{f.login}</span> : "Someone"} in <span className="font-medium">{f.repo}</span>
            <span className="block text-xs text-muted">
              {f.pending
                ? frozen
                  ? "Landed. Judged at the reveal."
                  : "Landed. Waiting for the next review."
                : f.changes.length === 0
                  ? "No level changed."
                  : f.changes.map((c) => `${LABEL[c.standard] ?? c.standard} ${c.from} → ${c.to}`).join(" · ")}
            </span>
          </span>
        </li>
      ))}
    </ol>
  );
}

const KIND: Record<string, string> = { change: "change", new: "new standard", remove: "remove or merge" };

function Proposals({ rows }: { rows: ProposalRow[] }) {
  if (rows.length === 0) return <p className="text-sm text-muted py-3 border-t border-border">No proposals reviewed yet.</p>;
  return (
    <ol className="border-t border-border">
      {rows.map((r, i) => (
        <li key={`${r.url}-${i}`} className="grid grid-cols-[1.5rem_1fr_auto] gap-x-4 items-center py-3 border-b border-border">
          <span className="font-mono text-xs text-muted">{String(i + 1).padStart(2, "0")}</span>
          {r.masked ? (
            <Hidden label="revealed at the prize-giving" />
          ) : (
            <span className="min-w-0 reveal-once">
              <a href={r.url} target="_blank" rel="noopener noreferrer" style={{ color: "inherit" }} className="font-medium [overflow-wrap:anywhere]">
                {r.title}
              </a>
              <span className="block text-xs font-mono text-muted">
                @{r.author} · {r.repo} · {KIND[r.kind] ?? r.kind}
              </span>
            </span>
          )}
          <span className="text-right font-mono tabular-nums text-sm">{r.masked ? "" : `${r.score}/15`}</span>
        </li>
      ))}
    </ol>
  );
}

function Rules() {
  return (
    <details className="mt-8 group" open>
      <summary className="cursor-pointer list-none text-sm font-medium mb-2">
        How you get on the leaderboard. <span className="font-mono text-xs text-muted group-open:hidden">show</span>
      </summary>
      <ol className="border-t border-border max-w-[820px]">
        {RULES.map((r, i) => (
          <li key={i} className="grid grid-cols-[1.5rem_1fr] gap-x-3 py-2 border-b border-border text-sm text-muted leading-relaxed">
            <span className="font-mono text-xs pt-0.5">{i + 1}</span>
            <span>{r}</span>
          </li>
        ))}
      </ol>
    </details>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="py-3 sm:px-6 first:pl-0 border-b sm:border-b-0 sm:border-l first:border-l-0 border-border">
      <p className="text-4xl sm:text-5xl font-medium tabular-nums leading-none">{value}</p>
      <p className="text-xs font-mono text-muted mt-2">{label}</p>
    </div>
  );
}

export default function PrizesView({ payload }: { payload: LeaderboardPayload | null }) {
  if (!payload) return null;
  const startsAt = clock(payload.start);
  const endsAt = clock(payload.end);

  if (payload.phase === "before") {
    return (
      <section aria-labelledby="prizes-title" className="mb-10">
        <h2 id="prizes-title" className="text-2xl font-medium mb-2">The day&apos;s leaderboard.</h2>
        <p className="text-sm text-muted leading-relaxed max-w-[720px]">
          Three prizes: best agent, most improved and top contributor. Counting starts at {startsAt} on 17 November and closes
          at {endsAt}. A review agent scores the quality of every standard, not only whether the file is there. Standards that come
          in during the day glow on the board below.
        </p>
        <Rules />
      </section>
    );
  }

  const status: string[] = [];
  if (payload.reveal) status.push(`The reveal: ${payload.reveal.step} of ${payload.reveal.total} places`);
  else if (payload.frozen) status.push(`Frozen at ${clock(payload.freeze)}, the result is revealed at the prize-giving`);
  else if (payload.phase === "after") status.push(`Closed at ${endsAt}`);
  else status.push(`Live since ${startsAt}, closes at ${endsAt}`);
  if (payload.graded.last_at && !payload.frozen) status.push(`last review ${clock(payload.graded.last_at)}`);
  if (payload.unread > 0) status.push(`${payload.unread} ${payload.unread === 1 ? "repo" : "repos"} not read yet`);
  const gained = payload.totals ? payload.totals.now - payload.totals.start : 0;

  return (
    <section aria-labelledby="prizes-title" className="mb-10">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 mb-4">
        <h2 id="prizes-title" className="text-2xl font-medium">The day&apos;s leaderboard.</h2>
        <p className="text-xs font-mono text-muted">{status.join(" · ")}</p>
      </div>

      {payload.totals && (
        <div className="grid sm:grid-cols-3 mb-8 border-y border-border">
          <Stat value={`${gained >= 0 ? "+" : ""}${gained}`} label={`points added since ${startsAt}`} />
          <Stat value={String(payload.totals.now)} label={`of ${payload.totals.max} points in place`} />
          <Stat value={payload.graded.last_at ? clock(payload.graded.last_at) : "–"} label="last review (13:30, 15:00, 16:15)" />
        </div>
      )}

      <BestAgent p={payload} />

      <div className="grid gap-8 lg:grid-cols-2">
        <div>
          <h3 className="text-base font-medium mb-1">Most improved.</h3>
          <p className="text-xs text-muted mb-3">Points gained since {startsAt} by a repo that existed then.</p>
          <Improved rows={payload.most_improved} />
        </div>
        <div>
          <h3 className="text-base font-medium mb-1">Top contributor.</h3>
          <p className="text-xs text-muted mb-3">Points added per person, over every repo. Open a name to see what.</p>
          <People rows={payload.top_contributor} />
        </div>
      </div>

      <div className="mt-8">
        <h3 className="text-base font-medium mb-1">Best additions to the standards.</h3>
        <p className="text-xs text-muted mb-3">Proposals on agent-template or docs/conventions, reviewed for real value and simplicity. Not merged today.</p>
        <Proposals rows={payload.proposals} />
      </div>

      <div className="mt-8">
        <h3 className="text-base font-medium mb-1">Just landed.</h3>
        <p className="text-xs text-muted mb-3">Every merge and push on a default branch today, with the levels from the last review.</p>
        <Feed items={payload.feed} frozen={payload.frozen} />
      </div>

      <Rules />
    </section>
  );
}
