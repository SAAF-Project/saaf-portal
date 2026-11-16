import { tally, type Checks } from "./standards";

// The figures of the board's summary line. Every repo counts nine standards; 60 repos make 540.

export interface BoardSummary {
  repos: number;
  tiles: number;
  met: number;
  /** Standards without an answer. They are neither in place nor missing. */
  unknown: number;
  complete: number;
}

export function summarise(repos: { checks: Checks }[]): BoardSummary {
  const out: BoardSummary = { repos: repos.length, tiles: 0, met: 0, unknown: 0, complete: 0 };
  for (const r of repos) {
    const t = tally(r.checks);
    out.tiles += t.total;
    out.met += t.met;
    out.unknown += t.unknown;
    if (t.complete) out.complete++;
  }
  return out;
}

const count = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

/** The parts of the summary line, for example ["212 of 405 standards met", "6 repos complete", "checked 14:32"]. */
export function summaryParts(s: BoardSummary, checkedAt: string | null): string[] {
  const parts = [`${s.met} of ${s.tiles} standards met`, `${count(s.complete, "repo", "repos")} complete`];
  if (checkedAt) parts.push(`checked ${checkedAt}`);
  return parts;
}

/** The small line under it: how many repos, and what is left out of the count. */
export function summaryNotes(s: BoardSummary, archived: number | null): string[] {
  const notes = [`${count(s.repos, "repo", "repos")} on the board`];
  if (s.unknown > 0) notes.push(`${count(s.unknown, "standard", "standards")} not checked`);
  if (archived) notes.push(`${count(archived, "archived repo", "archived repos")} left out`);
  return notes;
}
