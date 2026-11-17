import type { FeedItem } from "../../../lib/leaderboard";
import type { CheckRow, LeaderboardPayload, PersonRow, ProposalRow, RepoRow } from "../../../lib/leaderboard-day";
import { juryScoreText } from "../../../lib/jury-result";
import { DATA_RULE, DAY_TRACKS, DEMO_LINE, PRIZE_EUR, PRIZE_LINE, PRIZE_SHORT, RULES, SHORT_RULES, prizeShare } from "../../../lib/day-tracks";
import DayCountdown from "../../DayCountdown";
import { STANDARDS } from "./standards";
import { clock } from "./StandardsView";

// The day's leaderboard above the standards board. On top the three tracks of the day (src/lib/day-tracks.ts) with how
// you win each and who leads; below one list per track; then, folded away, the lists without a prize, the live feed
// and the rules. Pure: it draws the payload it is given (StandardsBoard.tsx fetches it), so it can be rendered in a
// test. Track 1 is scored by a review agent that grades the content of every standard (src/lib/leaderboard.ts); from
// 15:45 the top places are hidden until the organisers reveal them.

export { RULES, SHORT_RULES };

const LABEL: Record<string, string> = Object.fromEntries(STANDARDS.map((s) => [s.id, s.label]));
const HIDDEN = "revealed at 17:00";
const hair = "border-[color-mix(in_srgb,var(--on-panel)_16%,transparent)]";

export function Avatar({ login, size = 28 }: { login: string; size?: number }) {
  if (login === "?") return <span className="inline-block rounded-md bg-surface2 shrink-0" style={{ width: size, height: size }} />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={`https://github.com/${encodeURIComponent(login)}.png?size=${size * 2}`} alt="" width={size} height={size} loading="lazy" className="rounded-md bg-surface2 shrink-0" style={{ width: size, height: size }} />
  );
}

function Hidden({ label = HIDDEN }: { label?: string }) {
  return <span className="font-mono text-muted">? · {label}</span>;
}

/** Who leads a track, as one short block inside the tracks panel. */
function Leader({ lead, sub, empty }: { lead: string | null; sub?: string; empty: string }) {
  if (lead === null) return <p className="text-sm opacity-70">{empty}</p>;
  if (lead === "?") {
    return (
      <>
        <p className="text-3xl font-medium leading-none">?</p>
        <p className="text-xs font-mono opacity-70 mt-2">Revealed at 17:00.</p>
      </>
    );
  }
  return (
    <div key={lead} className="reveal-once">
      <p className="text-xl font-medium leading-tight [overflow-wrap:anywhere]">{lead}</p>
      {sub && <p className="text-xs font-mono opacity-70 mt-1 [overflow-wrap:anywhere]">{sub}</p>}
    </div>
  );
}

/** The repo list that carries the prize of track 1, and the one that does not. */
function track1(p: LeaderboardPayload): { prize: RepoRow[]; mention: RepoRow[] } {
  return p.prize === "most_improved" ? { prize: p.most_improved, mention: p.best_agent } : { prize: p.best_agent, mention: p.most_improved };
}

const names = (logins: string[]): string => logins.map((l) => `@${l}`).join(" ");

/** The prize in words: the amount, what each of the team gets, and who shares it when more names stand on the entry. */
export function prizeText(logins: string[]): string | null {
  const share = prizeShare(logins);
  if (!share) return null;
  const each = share.team.length > 1 ? ` · EUR ${share.each} each` : "";
  const who = logins.length > share.team.length ? ` for ${names(share.team)}` : "";
  return `EUR ${PRIZE_EUR}${each}${who}`;
}

/** Under the leader of a list: what the prize is worth to this team, now or once it is won. */
function Prize({ logins, won }: { logins: string[]; won: boolean }) {
  const text = prizeText(logins);
  if (!text) return null;
  return (
    <span className="block text-xs font-mono mt-1 [overflow-wrap:anywhere]">
      {won ? "Wins" : "Leads for"} {text}
    </span>
  );
}

/** The three tracks on one panel: how you win each and, once the day runs, who leads. */
export function TracksPanel({ p }: { p: LeaderboardPayload | null }) {
  const running = !!p && p.phase !== "before";
  const lead = p ? track1(p).prize[0] : undefined;
  const proposal = p?.proposals[0];
  const check = p?.checks[0];
  const share = (logins: string[]): string => {
    const text = prizeText(logins);
    return text ? ` · ${text}` : "";
  };
  const agentSub = lead && !lead.masked ? `${p!.prize === "most_improved" ? `+${lead.gain} points today` : `${lead.after} points, +${lead.gain} today`}${lead.by.length ? ` · ${names(lead.by)}` : ""}${share(lead.by)}` : undefined;
  const leaders = [
    <Leader key="agent" lead={!lead ? null : lead.masked ? "?" : lead.name} sub={agentSub} empty="No agent has gained points yet." />,
    <Leader key="standard" lead={!proposal ? null : proposal.masked ? "?" : proposal.title} sub={proposal && !proposal.masked ? `@${proposal.author} · ${proposal.score}/15${share([proposal.author])}` : undefined} empty="No proposal reviewed yet." />,
    p?.reveal ? (
      <Leader key="checks" lead={check?.masked ? "?" : check?.place ? check.repo : null} sub={check?.place ? `${names(check.authors)}${check.place === 1 ? share(check.authors) : ""}` : undefined} empty="The jury has not chosen yet." />
    ) : (
      <Leader
        key="checks"
        lead={p && p.checks_total > 0 ? `${p.checks_total} ${p.checks_total === 1 ? "repo has" : "repos have"} LLM checks` : null}
        sub="The jury picks the winner at 16:15."
        empty="No repo has LLM checks yet."
      />
    ),
  ];
  return (
    <div className="rounded-2xl p-6 sm:p-8 mb-6" style={{ background: "var(--panel)", color: "var(--on-panel)" }}>
      <ul className="grid md:grid-cols-3">
        {DAY_TRACKS.map((t, i) => (
          <li key={t.id} className={`py-4 md:py-0 md:px-6 first:pt-0 md:first:pl-0 last:pb-0 md:last:pr-0 border-b md:border-b-0 md:border-l first:border-l-0 last:border-b-0 ${hair}`}>
            <p className="font-mono text-xs opacity-70 mb-2">Track {t.number}</p>
            <h3 className="text-2xl font-medium leading-tight mb-2">{t.name}</h3>
            <p className="text-sm opacity-80 leading-relaxed">{t.win}</p>
            <p className="font-mono text-xs opacity-70 mt-2">{PRIZE_SHORT}</p>
            {running && <div className={`mt-4 pt-4 border-t ${hair}`}>{leaders[i]}</div>}
          </li>
        ))}
      </ul>
      <p className={`mt-6 pt-4 border-t ${hair} text-xs font-mono opacity-70`}>
        {PRIZE_LINE} {DEMO_LINE}
      </p>
    </div>
  );
}

/** Track 1 when the prize is for the rise: the gain large, from where to where, and who did it. */
function Improved({ rows, won }: { rows: RepoRow[]; /** null: this list carries no prize. */ won: boolean | null }) {
  if (rows.length === 0) return <p className="text-sm text-muted py-3 border-t border-border">No repo has gained points yet.</p>;
  return (
    <ol className="border-t border-border">
      {rows.map((r, i) => (
        <li key={`${r.name}-${i}`} className="grid grid-cols-[1.5rem_1fr_auto] gap-x-4 items-center py-3 border-b border-border">
          <span className="font-mono text-xs text-muted">{String(i + 1).padStart(2, "0")}</span>
          {r.masked ? (
            <Hidden />
          ) : (
            <span className="min-w-0 reveal-once">
              <a href={r.url} target="_blank" rel="noopener noreferrer" style={{ color: "inherit" }} className="font-medium [overflow-wrap:anywhere]">
                {r.name}
              </a>
              {r.by.length > 0 && <span className="block text-xs font-mono text-muted [overflow-wrap:anywhere]">{r.by.map((l) => `@${l}`).join(" · ")}</span>}
              {i === 0 && won !== null && <Prize logins={r.by} won={won} />}
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

/** The repos with the highest score at the close. */
function Agents({ rows }: { rows: RepoRow[] }) {
  if (rows.length === 0) return <p className="text-sm text-muted py-3 border-t border-border">No agent has gained enough yet.</p>;
  return (
    <ol className="border-t border-border">
      {rows.map((r, i) => (
        <li key={`${r.name}-${i}`} className="grid grid-cols-[1.5rem_1fr_auto] gap-x-4 items-baseline py-2 border-b border-border text-sm">
          <span className="font-mono text-xs text-muted">{String(i + 1).padStart(2, "0")}</span>
          {r.masked ? <Hidden /> : <span className="font-medium min-w-0 [overflow-wrap:anywhere] reveal-once">{r.name}</span>}
          <span className="font-mono tabular-nums text-muted">{r.masked ? "" : `${r.after} points · +${r.gain} today`}</span>
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
            <Hidden />
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

function Proposals({ rows, won }: { rows: ProposalRow[]; won: boolean }) {
  if (rows.length === 0) return <p className="text-sm text-muted py-3 border-t border-border">No proposals reviewed yet.</p>;
  return (
    <ol className="border-t border-border">
      {rows.map((r, i) => (
        <li key={`${r.url}-${i}`} className="grid grid-cols-[1.5rem_1fr_auto] gap-x-4 items-center py-3 border-b border-border">
          <span className="font-mono text-xs text-muted">{String(i + 1).padStart(2, "0")}</span>
          {r.masked ? (
            <Hidden />
          ) : (
            <span className="min-w-0 reveal-once">
              <a href={r.url} target="_blank" rel="noopener noreferrer" style={{ color: "inherit" }} className="font-medium [overflow-wrap:anywhere]">
                {r.title}
              </a>
              <span className="block text-xs font-mono text-muted">
                @{r.author} · {r.repo} · {KIND[r.kind] ?? r.kind}
              </span>
              {i === 0 && <Prize logins={[r.author]} won={won} />}
            </span>
          )}
          <span className="text-right font-mono tabular-nums text-sm">{r.masked ? "" : `${r.score}/15`}</span>
        </li>
      ))}
    </ol>
  );
}

/** Track 3: the repos with LLM checks. A place shows only once the organisers reveal it. */
function Checks({ rows }: { rows: CheckRow[] }) {
  if (rows.length === 0) return <p className="text-sm text-muted py-3 border-t border-border">No repo has LLM checks yet.</p>;
  return (
    <ol className="border-t border-border">
      {rows.map((r, i) => (
        <li key={`${r.repo}-${i}`} className="grid grid-cols-[1.5rem_1fr_auto] gap-x-4 items-center py-3 border-b border-border">
          <span className="font-mono text-xs text-muted">{r.place ? String(r.place).padStart(2, "0") : r.masked ? String(i + 1).padStart(2, "0") : "·"}</span>
          {r.masked ? (
            <Hidden />
          ) : (
            <span className="min-w-0 reveal-once">
              <a href={r.url} target="_blank" rel="noopener noreferrer" style={{ color: "inherit" }} className="font-medium [overflow-wrap:anywhere]">
                {r.repo}
              </a>
              {r.authors.length > 0 && <span className="block text-xs font-mono text-muted [overflow-wrap:anywhere]">{r.authors.map((l) => `@${l}`).join(" · ")}</span>}
              {r.place === 1 && <Prize logins={r.authors} won />}
              {r.place && r.jury && (r.jury.score !== null || r.jury.reason) && (
                <span className="block text-xs text-muted mt-1 [overflow-wrap:anywhere]">Jury: {[juryScoreText(r.jury), r.jury.reason].filter(Boolean).join(" · ")}</span>
              )}
            </span>
          )}
          <span className="text-right font-mono tabular-nums text-sm text-muted">{r.masked ? "" : `${r.llm} ${r.llm === 1 ? "check" : "checks"}`}</span>
        </li>
      ))}
    </ol>
  );
}

/** Five rules everyone needs, and all of them one click further. Closed by default: the handout has them too. */
function Rules() {
  return (
    <details className="mt-8 group" id="rules">
      <summary className="cursor-pointer list-none text-sm font-medium mb-2">
        The rules. <span className="font-mono text-xs text-muted group-open:hidden">show</span>
        <span className="font-mono text-xs text-muted hidden group-open:inline">hide</span>
      </summary>
      <ol className="border-t border-border max-w-[820px]">
        {SHORT_RULES.map((r, i) => (
          <li key={i} className="grid grid-cols-[1.5rem_1fr] gap-x-3 py-2 border-b border-border text-sm text-muted leading-relaxed">
            <span className="font-mono text-xs pt-0.5">{i + 1}</span>
            <span>{r}</span>
          </li>
        ))}
      </ol>
      <p className="text-sm text-muted mt-2 max-w-[820px]">{DATA_RULE}</p>
      <details className="mt-4 group/all">
        <summary className="cursor-pointer list-none text-xs font-mono text-muted mb-2">
          All rules <span className="group-open/all:hidden">· show</span>
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
    </details>
  );
}

export default function PrizesView({ payload, clockNow }: { payload: LeaderboardPayload | null; /** A fixed moment for the countdown, for previews and tests. */ clockNow?: string }) {
  if (!payload) return null;
  const startsAt = clock(payload.start);
  const endsAt = clock(payload.end);

  if (payload.phase === "before") {
    return (
      <section aria-labelledby="prizes-title" className="mb-10">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 mb-4">
          <h2 id="prizes-title" className="text-2xl font-medium">Three tracks, three winners.</h2>
          <p className="text-xs font-mono text-muted">
            Counting starts at {startsAt} on 17 November and closes at {endsAt}
          </p>
        </div>
        <DayCountdown fixedNow={clockNow} />
        <TracksPanel p={payload} />
        <Rules />
      </section>
    );
  }

  const status: string[] = [];
  if (payload.reveal) status.push(`The reveal: step ${payload.reveal.step} of ${payload.reveal.total}`);
  else if (payload.frozen) status.push(`Frozen at ${clock(payload.freeze)}, the winners are revealed at 17:00`);
  else if (payload.phase === "after") status.push(`Closed at ${endsAt}`);
  else status.push(`Live since ${startsAt}, closes at ${endsAt}`);
  if (payload.totals && !payload.frozen) {
    const gained = payload.totals.now - payload.totals.start;
    status.push(`${gained >= 0 ? "+" : ""}${gained} points since ${startsAt}`);
  }
  if (payload.graded.last_at && !payload.frozen) status.push(`last review ${clock(payload.graded.last_at)}`);
  if (payload.unread > 0) status.push(`${payload.unread} ${payload.unread === 1 ? "repo" : "repos"} not read yet`);
  if (payload.disqualified > 0) status.push(`${payload.disqualified} ${payload.disqualified === 1 ? "participant" : "participants"} disqualified`);
  const { prize, mention } = track1(payload);
  const byRise = payload.prize === "most_improved";
  // The first row of a list has won once the prize-giving shows it, or after the close when nothing is hidden.
  const won = !!payload.reveal || (payload.phase === "after" && !payload.frozen);

  return (
    <section aria-labelledby="prizes-title" className="mb-10">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 mb-4">
        <h2 id="prizes-title" className="text-2xl font-medium">Three tracks, three winners.</h2>
        <p className="text-xs font-mono text-muted">{status.join(" · ")}</p>
      </div>

      <DayCountdown fixedNow={clockNow} />
      <TracksPanel p={payload} />

      <div className="grid gap-8 lg:grid-cols-3">
        <div>
          <h3 className="text-base font-medium mb-1">Track 1 · {byRise ? "Most quality added." : "Best agent."}</h3>
          <p className="text-xs text-muted mb-3">
            {byRise ? `Points gained since ${startsAt} by an agent that existed then, and the team that added them.` : `The highest score at ${endsAt}, with at least 4 points gained today.`}
          </p>
          {byRise ? <Improved rows={prize} won={won} /> : <Agents rows={prize} />}
        </div>
        <div>
          <h3 className="text-base font-medium mb-1">Track 2 · Best additions to the standards.</h3>
          <p className="text-xs text-muted mb-3">Proposals on agent-template or docs/conventions, reviewed for real value and simplicity. Not merged today.</p>
          <Proposals rows={payload.proposals} won={won} />
        </div>
        <div>
          <h3 className="text-base font-medium mb-1">Track 3 · LLM checks.</h3>
          <p className="text-xs text-muted mb-3">Repos with an llm_checks.yaml on the default branch. Orq.ai and an auditor pick the winner at 16:15.</p>
          <Checks rows={payload.checks} />
        </div>
      </div>

      {/* Open during the prize-giving: its first two steps are the mentions in this block. */}
      <details className="mt-8 group" open={payload.reveal ? true : undefined}>
        <summary className="cursor-pointer list-none text-sm font-medium mb-2">
          Also today, without a prize. <span className="font-mono text-xs text-muted group-open:hidden">show</span>
          <span className="font-mono text-xs text-muted hidden group-open:inline">hide</span>
        </summary>
        <div className="grid gap-8 lg:grid-cols-2 mt-4">
          <div>
            <h3 className="text-base font-medium mb-1">{byRise ? "Best agent." : "Most improved."}</h3>
            <p className="text-xs text-muted mb-3">{byRise ? `The highest score at ${endsAt}, with at least 4 points gained today.` : `Points gained since ${startsAt} by a repo that existed then.`}</p>
            {byRise ? <Agents rows={mention} /> : <Improved rows={mention} won={null} />}
          </div>
          <div>
            <h3 className="text-base font-medium mb-1">Top contributor.</h3>
            <p className="text-xs text-muted mb-3">Points added per person, over every repo. Open a name to see what.</p>
            <People rows={payload.top_contributor} />
          </div>
        </div>
        <div className="mt-8">
          <h3 className="text-base font-medium mb-1">Just landed.</h3>
          <p className="text-xs text-muted mb-3">Every merge and push on a default branch today, with the levels from the last review.</p>
          <Feed items={payload.feed} frozen={payload.frozen} />
        </div>
      </details>

      <Rules />
    </section>
  );
}
