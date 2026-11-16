import type { ReactNode } from "react";
import { DAY_TRACKS, type TrackId } from "../../../lib/day-tracks";
import { juryPartsText, juryScoreText } from "../../../lib/jury-result";
import type { CheckRow, LeaderboardPayload } from "../../../lib/leaderboard-day";
import { Avatar, prizeText } from "./PrizesView";
import "./winners.css";

// The winners view: the big-screen page of the prize-giving at 17:00, opened from the admin. It draws the same public
// data as the board, so it shows only what the organisers have revealed: first the two mentions, then one track at a
// time as a podium (third place, second place, the winner), and at the end the three winners together. Pure: it draws
// the payload it is given (WinnersScreen.tsx fetches it), so it is rendered in a test.

export type WinnersStage = "waiting" | "mentions" | "checks" | "standard" | "agent" | "all";
export type TrackStage = Extract<WinnersStage, "checks" | "standard" | "agent">;

interface Entry {
  key: string;
  title: string;
  team: string[];
  line: string;
  /** What the winner gets; null for the second and third place. */
  prize: string | null;
  jury?: CheckRow["jury"];
}

/** A place on the podium. Without an entry the place exists but is not revealed yet. */
export interface Slot {
  place: 1 | 2 | 3;
  entry: Entry | null;
}

const TEAM_SHOWN = 4;
const STAGE_OF: Record<TrackId, TrackStage> = { agent: "agent", standard: "standard", checks: "checks" };
const prizeList = (p: LeaderboardPayload) => (p.prize === "most_improved" ? p.most_improved : p.best_agent);
const mentionList = (p: LeaderboardPayload) => (p.prize === "most_improved" ? p.best_agent : p.most_improved);
const placeOf = (i: number) => (i + 1) as 1 | 2 | 3;

/** The podium of a track, from the public data: the hidden places are the masked rows at the top of each list. */
export function podium(p: LeaderboardPayload, stage: TrackStage): Slot[] {
  if (stage === "agent") {
    const byRise = p.prize === "most_improved";
    return prizeList(p)
      .slice(0, 3)
      .map((r, i) => ({
        place: placeOf(i),
        entry: r.masked ? null : { key: r.name, title: r.name, team: r.by, line: byRise ? `+${r.gain} points today · from ${r.before} to ${r.after}` : `${r.after} points · +${r.gain} today`, prize: i === 0 ? prizeText(r.by) : null },
      }));
  }
  if (stage === "standard") {
    return p.proposals.slice(0, 3).map((r, i) => ({
      place: placeOf(i),
      entry: r.masked ? null : { key: r.url || r.title, title: r.title, team: [r.author], line: `${r.repo} · ${r.score}/15`, prize: i === 0 ? prizeText([r.author]) : null },
    }));
  }
  const slots: Slot[] = [];
  p.checks.slice(0, 3).forEach((r, i) => {
    if (r.masked) slots.push({ place: placeOf(i), entry: null });
    else if (r.place === i + 1) slots.push({ place: placeOf(i), entry: { key: r.repo, title: r.repo, team: r.authors, line: `${r.llm} ${r.llm === 1 ? "check" : "checks"}`, prize: i === 0 ? prizeText(r.authors) : null, jury: r.jury } });
  });
  return slots;
}

const shown = (slots: Slot[]): number => slots.filter((s) => s.entry).length;

/** Where the prize-giving is: the part revealed last, and whether everything is out. */
export function winnersStage(p: LeaderboardPayload | null): { stage: Exclude<WinnersStage, "all">; done: boolean } {
  if (!p?.reveal) return { stage: "waiting", done: false };
  const stage = shown(podium(p, "agent")) > 0 ? "agent" : shown(podium(p, "standard")) > 0 ? "standard" : shown(podium(p, "checks")) > 0 ? "checks" : "mentions";
  return { stage, done: p.reveal.total > 0 && p.reveal.step >= p.reveal.total };
}

/** The stages that have something to show, in the order of the prize-giving. */
export function stagesShown(p: LeaderboardPayload | null): WinnersStage[] {
  if (!p?.reveal) return [];
  const out: WinnersStage[] = ["mentions"];
  for (const s of ["checks", "standard", "agent"] as const) if (shown(podium(p, s)) > 0) out.push(s);
  if (winnersStage(p).done) out.push("all");
  return out;
}

function Team({ logins }: { logins: string[] }) {
  if (logins.length === 0) return null;
  return (
    <p className="win-team font-mono">
      {logins.slice(0, TEAM_SHOWN).map((l) => (
        <span key={l} className="inline-flex items-center gap-1.5">
          <Avatar login={l} size={24} />@{l}
        </span>
      ))}
      {logins.length > TEAM_SHOWN && <span>+{logins.length - TEAM_SHOWN}</span>}
    </p>
  );
}

function Said({ jury, large }: { jury: Entry["jury"]; large: boolean }) {
  if (!jury) return null;
  const numbers = [juryScoreText(jury), juryPartsText(jury.parts)].filter(Boolean).join(" · ");
  return (
    <>
      {numbers && <p className="win-line font-mono">Jury: {numbers}</p>}
      {jury.reason && <p className={large ? "win-reason" : "win-line"}>{jury.reason}</p>}
    </>
  );
}

function Podium({ slots }: { slots: Slot[] }) {
  if (slots.length === 0) return <p className="win-sub">No place in this track.</p>;
  return (
    <ol className="win-podium">
      {slots.map(({ place, entry }) => (
        <li key={place} className={`win-col win-col-${place}`}>
          <div className="win-card">
            {entry && (
              <div key={entry.key} className="reveal-once">
                <p className="win-name">{entry.title}</p>
                <Team logins={entry.team} />
                <p className="win-line font-mono">{entry.line}</p>
                <Said jury={entry.jury} large={place === 1} />
                {entry.prize && <p className="win-prize">Wins {entry.prize}</p>}
              </div>
            )}
          </div>
          <div className={`win-step win-step-${place}`}>
            <p className="win-numeral font-mono" aria-label={`Place ${place}`}>
              P{place}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}

function Mentions({ p }: { p: LeaderboardPayload }) {
  const byRise = p.prize === "most_improved";
  const people = p.top_contributor.slice(0, 3);
  const repos = mentionList(p).slice(0, 3);
  return (
    <div className="win-pair">
      <section>
        <h2 className="win-eyebrow font-mono mb-2">Top contributor · points added per person</h2>
        <ol className="win-list">
          {people.map((x, i) => (
            <li key={`${x.login}-${i}`}>
              <span className="font-mono text-muted">{String(i + 1).padStart(2, "0")}</span>
              {x.masked ? <span className="font-mono text-muted">?</span> : <span className="reveal-once inline-flex items-center gap-2 min-w-0 [overflow-wrap:anywhere]"><Avatar login={x.login} size={28} />@{x.login}</span>}
              <span className="font-mono tabular-nums text-muted">{x.masked ? "" : `${x.points} points`}</span>
            </li>
          ))}
        </ol>
      </section>
      <section>
        <h2 className="win-eyebrow font-mono mb-2">{byRise ? "Best agent · the highest score of the day" : "Most improved · points gained today"}</h2>
        <ol className="win-list">
          {repos.map((r, i) => (
            <li key={`${r.name}-${i}`}>
              <span className="font-mono text-muted">{String(i + 1).padStart(2, "0")}</span>
              {r.masked ? <span className="font-mono text-muted">?</span> : <span className="reveal-once min-w-0 [overflow-wrap:anywhere]">{r.name}</span>}
              <span className="font-mono tabular-nums text-muted">{r.masked ? "" : byRise ? `${r.after} points` : `+${r.gain}`}</span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

function All({ p }: { p: LeaderboardPayload }) {
  const person = p.top_contributor[0];
  const repo = mentionList(p)[0];
  const also = [person && !person.masked ? `Top contributor: @${person.login}` : null, repo && !repo.masked ? `${p.prize === "most_improved" ? "Best agent" : "Most improved"}: ${repo.name}` : null].filter(Boolean);
  return (
    <>
      <ol className="win-all">
        {DAY_TRACKS.map((t) => {
          const winner = podium(p, STAGE_OF[t.id]).find((s) => s.place === 1)?.entry ?? null;
          return (
            <li key={t.id} className="min-w-0">
              <p className="win-eyebrow font-mono mb-2">
                Track {t.number} · {t.name}
              </p>
              {winner ? (
                <div className="reveal-once">
                  <p className="win-name">{winner.title}</p>
                  <Team logins={winner.team} />
                  {winner.jury?.reason && <p className="win-line">{winner.jury.reason}</p>}
                  {winner.prize && <p className="win-prize">Wins {winner.prize}</p>}
                </div>
              ) : (
                <p className="win-name">·</p>
              )}
            </li>
          );
        })}
      </ol>
      {also.length > 0 && <p className="win-also font-mono">{also.join(" · ")}</p>}
    </>
  );
}

/** What a screen reader hears when the screen changes. */
export function announcement(p: LeaderboardPayload | null, stage: WinnersStage): string {
  if (!p?.reveal || stage === "waiting") return "The winners are revealed at 17:00.";
  if (stage === "mentions") return "Honourable mentions.";
  if (stage === "all") {
    const names = DAY_TRACKS.map((t) => podium(p, STAGE_OF[t.id]).find((s) => s.place === 1)?.entry?.title).filter(Boolean);
    return `The winners: ${names.join(", ")}.`;
  }
  const track = DAY_TRACKS.find((t) => STAGE_OF[t.id] === stage)!;
  const latest = podium(p, stage).find((s) => s.entry);
  return latest?.entry ? `Track ${track.number}, place ${latest.place}: ${latest.entry.title}.` : `Track ${track.number}.`;
}

export default function WinnersView({ payload, view = "auto", footer }: { payload: LeaderboardPayload | null; /** "auto" follows the prize-giving. */ view?: "auto" | WinnersStage; footer?: ReactNode }) {
  const at = winnersStage(payload);
  const stage: WinnersStage = !payload?.reveal ? "waiting" : view === "auto" ? at.stage : view;
  const track = DAY_TRACKS.find((t) => STAGE_OF[t.id] === stage);
  const title = stage === "waiting" ? "The winners." : stage === "mentions" ? "Honourable mentions." : stage === "all" ? "The winners of the hardening day." : `Track ${track!.number} · ${track!.name}`;
  const sub =
    stage === "waiting"
      ? "Revealed at 17:00."
      : stage === "mentions"
        ? "Two lists without a prize."
        : stage === "all"
          ? "Three tracks, one winner each."
          : `${track!.win}${stage === "checks" && payload?.checks_jury?.length ? ` The jury: ${payload.checks_jury.join("; ")}.` : ""}`;
  return (
    <div className="win-screen">
      <header>
        <div className="flex flex-wrap items-center justify-between gap-4 mb-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/saaf-lockup-ink.png" alt="SAAF, Shared Audit Agents Framework" className="win-logo" />
          <p className="win-eyebrow font-mono">
            Session #11 · Hardening day · 17 November 2026{payload?.reveal ? ` · step ${payload.reveal.step} of ${payload.reveal.total}` : ""}
          </p>
        </div>
        <h1 className="win-title">{title}</h1>
        <p className="win-sub">{sub}</p>
      </header>
      <main className={`win-main${track ? "" : " win-main-middle"}`}>
        {payload?.reveal && stage === "mentions" && <Mentions p={payload} />}
        {payload?.reveal && stage === "all" && <All p={payload} />}
        {payload?.reveal && track && <Podium slots={podium(payload, stage as TrackStage)} />}
      </main>
      <p className="sr-only" role="status" aria-live="polite">
        {announcement(payload, stage)}
      </p>
      {footer}
    </div>
  );
}
