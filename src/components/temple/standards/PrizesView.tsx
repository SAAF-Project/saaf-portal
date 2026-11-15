import type { PersonRow, PrizeRow, PrizesPayload } from "../../../lib/standards-prizes";
import { STANDARDS } from "./standards";
import { clock } from "./StandardsView";

// The day's leaderboard above the standards board: the first prize large, then the biggest jumps, the people who added
// the most standards, the new repos, and the rules. Pure: it draws the payload it is given (StandardsBoard.tsx fetches
// it), so it can be rendered in a test. The portal works it all out from GitHub's history (src/lib/standards-prizes.ts).

/** Time of day to the second, in the viewer's own time zone: "11:47:12". The first prize is decided by seconds. */
const exact = (iso: string): string => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

export const RULES: string[] = [
  "Fix a standard in an agent repo that existed before 09:00. It counts once it lands on the default branch between 09:00 and 16:15.",
  "Work on as many repos as you like. Every standard you add counts towards your own score, across all repos.",
  "A merged pull request counts for the person who opened it, whoever presses merge. A direct push counts for whoever pushed.",
  "Two people fix the same standard in the same repo: the first to land counts and the second adds nothing new. Split the work before you start.",
  "A standard must still be in place at 16:15. Removed and put back, it stays with whoever added it first.",
  "Times are GitHub's own push and merge times, to the second. Commit dates do not count. A tie goes to whoever got there first.",
  "Bots do not count. New repos made today, and empty or placeholder files, are judged by the organisers.",
];

/** A repo as one face of nine: what it had at the start, what came in today (glowing), and what is still missing. */
function Face({ had, added, size, onPanel = false }: { had: string[]; added: string[]; size: "sm" | "lg"; onPanel?: boolean }) {
  const cell = size === "lg" ? "w-7 h-7 sm:w-9 sm:h-9 rounded-md" : "w-2.5 h-2.5 rounded-[2px]";
  const gap = size === "lg" ? "gap-1.5 sm:gap-2" : "gap-[3px]";
  return (
    <span role="img" aria-label={`${had.length + added.length} of ${STANDARDS.length} standards, ${added.length} added today`} className={`inline-grid grid-cols-3 ${gap} shrink-0`}>
      {STANDARDS.map((s) => {
        const state = added.includes(s.id) ? "added" : had.includes(s.id) ? "had" : "missing";
        const look =
          state === "added"
            ? "std-glow border"
            : state === "had"
              ? onPanel
                ? "bg-[color-mix(in_srgb,var(--on-panel)_45%,transparent)]"
                : "bg-accent/40"
              : onPanel
                ? "border border-[color-mix(in_srgb,var(--on-panel)_25%,transparent)]"
                : "border border-muted/60";
        return <span key={s.id} title={`${s.label}: ${state === "added" ? "added today" : state === "had" ? "in place" : "missing"}`} className={`${cell} ${look}`} />;
      })}
    </span>
  );
}

function Avatar({ login, size = 28 }: { login: string; size?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://github.com/${encodeURIComponent(login)}.png?size=${size * 2}`}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      className="rounded-md bg-surface2 shrink-0"
      style={{ width: size, height: size }}
    />
  );
}

/** Who did it, as faces and handles. */
function People({ logins, onPanel = false }: { logins: string[]; onPanel?: boolean }) {
  if (logins.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-2 mt-4" aria-label="Credited">
      {logins.map((l) => (
        <li key={l} className={`flex items-center gap-2 text-sm font-mono ${onPanel ? "" : "text-muted"}`}>
          <Avatar login={l} size={onPanel ? 28 : 20} />@{l}
        </li>
      ))}
    </ul>
  );
}

function FirstPrize({ payload }: { payload: PrizesPayload }) {
  const [winner, ...next] = payload.first_nine;
  const lead = winner ?? payload.closest[0] ?? null;
  const final = payload.phase === "after";
  return (
    <div className="rounded-2xl p-6 sm:p-8 mb-8" style={{ background: "var(--panel)", color: "var(--on-panel)" }}>
      <div className="grid gap-6 md:grid-cols-[1fr_auto] items-center">
        <div className="min-w-0">
          <p className="font-mono text-xs opacity-70 mb-3">
            First prize · {final ? "winner" : "first existing agent to meet all nine standards"}
          </p>
          {winner ? (
            <>
              <a href={winner.url} target="_blank" rel="noopener noreferrer" style={{ color: "inherit" }} className="block text-4xl sm:text-5xl font-medium leading-[1.05] [overflow-wrap:anywhere]">
                {winner.name}
              </a>
              <p className="mt-3 text-base opacity-80">
                All nine at <span className="font-mono">{winner.reached_at ? exact(winner.reached_at) : ""}</span> · +{winner.jump} since {clock(payload.start)}
              </p>
              <People logins={winner.by} onPanel />
            </>
          ) : (
            <>
              <p className="text-3xl sm:text-4xl font-medium leading-tight">{final ? "Nobody reached all nine." : "Nobody has all nine yet."}</p>
              {lead && (
                <p className="mt-3 text-base opacity-80">
                  Closest {final ? "at the end" : "now"}: <span className="font-medium">{lead.name}</span>, {lead.after} of {STANDARDS.length}.
                  {!final && " The first to get there wins."}
                </p>
              )}
              {payload.closest.length > 1 && (
                <ul className="mt-3 text-sm opacity-70 font-mono">
                  {payload.closest.slice(1).map((r) => (
                    <li key={r.name}>
                      {r.name} · {r.after} of {STANDARDS.length}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
        {lead && <Face had={lead.had} added={lead.added} size="lg" onPanel />}
      </div>
      {next.length > 0 && (
        <ol className="mt-6 border-t border-[color-mix(in_srgb,var(--on-panel)_16%,transparent)]">
          {next.map((r, i) => (
            <li key={r.name} className="flex items-baseline gap-4 py-2 border-b border-[color-mix(in_srgb,var(--on-panel)_16%,transparent)] text-sm">
              <span className="font-mono text-xs opacity-60">{String(i + 2).padStart(2, "0")}</span>
              <span className="font-medium flex-1 min-w-0 [overflow-wrap:anywhere]">{r.name}</span>
              <span className="font-mono tabular-nums opacity-80">{r.reached_at ? exact(r.reached_at) : ""}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function Jumps({ rows }: { rows: PrizeRow[] }) {
  if (rows.length === 0) return <p className="text-sm text-muted py-3 border-t border-border">No standards added yet.</p>;
  return (
    <ol className="border-t border-border">
      {rows.map((r, i) => (
        <li key={r.name} className="grid grid-cols-[1.5rem_1fr_auto_auto] gap-x-4 items-center py-3 border-b border-border">
          <span className="font-mono text-xs text-muted">{String(i + 1).padStart(2, "0")}</span>
          <span className="min-w-0">
            <a href={r.url} target="_blank" rel="noopener noreferrer" style={{ color: "inherit" }} className="font-medium [overflow-wrap:anywhere]">
              {r.name}
            </a>
            {r.by.length > 0 && <span className="block text-xs font-mono text-muted [overflow-wrap:anywhere]">{r.by.map((l) => `@${l}`).join(" · ")}</span>}
          </span>
          <Face had={r.had} added={r.added} size="sm" />
          <span className="text-right">
            <span className="block text-2xl font-medium tabular-nums leading-none">+{r.jump}</span>
            <span className="block text-xs font-mono text-muted mt-1">
              {r.before} → {r.after}
            </span>
          </span>
        </li>
      ))}
    </ol>
  );
}

function Leaders({ people }: { people: PersonRow[] }) {
  if (people.length === 0) return <p className="text-sm text-muted py-3 border-t border-border">Nobody has added a standard yet.</p>;
  return (
    <ol className="border-t border-border">
      {people.map((p, i) => (
        <li key={p.login} className="grid grid-cols-[1.5rem_auto_1fr_auto] gap-x-3 items-center py-3 border-b border-border">
          <span className="font-mono text-xs text-muted">{String(i + 1).padStart(2, "0")}</span>
          <Avatar login={p.login} size={32} />
          <span className="min-w-0">
            <span className="block font-medium [overflow-wrap:anywhere]">@{p.login}</span>
            <span className="block text-xs font-mono text-muted">
              in {p.repos.length} {p.repos.length === 1 ? "repo" : "repos"}
            </span>
          </span>
          <span className="text-2xl font-medium tabular-nums leading-none">{p.added}</span>
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
      <ol className="border-t border-border max-w-[760px]">
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

export default function PrizesView({ payload }: { payload: PrizesPayload | null }) {
  if (!payload) return null;
  const startsAt = clock(payload.start);
  const endsAt = clock(payload.end);

  if (payload.phase === "before") {
    return (
      <section aria-labelledby="prizes-title" className="mb-10">
        <h2 id="prizes-title" className="text-2xl font-medium mb-2">The day&apos;s leaderboard.</h2>
        <p className="text-sm text-muted leading-relaxed max-w-[680px]">
          Counting starts at {startsAt} on 17 November and closes at {endsAt}. The portal reads every push and merge from
          GitHub and keeps the score itself. Standards that come in during the day glow on the board below.
        </p>
        <Rules />
      </section>
    );
  }

  const final = payload.phase === "after";
  const notes = [final ? `Final, counted at ${endsAt}` : `Live since ${startsAt}${payload.computed_at ? `, counted ${clock(payload.computed_at)}` : ""}, closes at ${endsAt}`];
  if (payload.unread > 0) notes.push(`${payload.unread} ${payload.unread === 1 ? "repo" : "repos"} not read yet`);
  const gained = payload.standards ? payload.standards.now - payload.standards.start : 0;

  return (
    <section aria-labelledby="prizes-title" className="mb-10">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 mb-4">
        <h2 id="prizes-title" className="text-2xl font-medium">The day&apos;s leaderboard.</h2>
        <p className="text-xs font-mono text-muted">{notes.join(" · ")}</p>
      </div>

      <div className="grid sm:grid-cols-3 mb-8 border-y border-border">
        <Stat value={`${gained >= 0 ? "+" : ""}${gained}`} label={`standards added since ${startsAt}`} />
        <Stat value={String(payload.people_total)} label={payload.people_total === 1 ? "person on the board" : "people on the board"} />
        <Stat value={String(payload.finished)} label={payload.finished === 1 ? "agent reached all nine today" : "agents reached all nine today"} />
      </div>

      <FirstPrize payload={payload} />

      <div className="grid gap-8 lg:grid-cols-2">
        <div>
          <h3 className="text-base font-medium mb-1">Biggest jump since {startsAt}.</h3>
          <p className="text-xs text-muted mb-3">Second prize. Standards in place now, minus those at {startsAt}.</p>
          <Jumps rows={payload.biggest_jump} />
        </div>
        <div>
          <h3 className="text-base font-medium mb-1">Most standards added.</h3>
          <p className="text-xs text-muted mb-3">Per person, over every repo they worked on.</p>
          <Leaders people={payload.people} />
        </div>
      </div>

      {payload.new_repos.length > 0 && (
        <div className="mt-8">
          <h3 className="text-base font-medium mb-1">New today.</h3>
          <p className="text-xs text-muted mb-3">Made during the day, so outside the count. The organisers judge these.</p>
          <ul className="flex flex-wrap gap-2">
            {payload.new_repos.map((r) => (
              <li key={r.name}>
                <a href={r.url} target="_blank" rel="noopener noreferrer" style={{ color: "inherit" }} className="inline-flex items-center gap-3 rounded-lg border border-border px-3 py-2 text-sm">
                  {r.name} <span className="font-mono text-xs text-muted">{r.met}/9</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Rules />
    </section>
  );
}
