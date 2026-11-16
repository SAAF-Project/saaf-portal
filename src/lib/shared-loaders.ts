import { DAY } from "./leaderboard-day";
import { mapLimited } from "./repo-signals";
import { loadRepoStandards, seedRepoStandards, type StandardsPayload } from "./repo-standards";
import { snapshot } from "./snapshot";
import { databaseStore } from "./snapshot-db";
import { historyOf, seedHistories, type History } from "./standards-prizes";

// What the standards board and the day's leaderboard read from GitHub, shared by every server instance through one
// database row (src/lib/snapshot.ts). One instance at a time asks GitHub, about once a minute; all the others, however
// many tabs are open, read the row. A fresh instance starts from the answers in the row, so it asks GitHub only about
// repos that were pushed since.

const CONCURRENCY = 6;
const TTL_MS = 60_000;
/** Change this when the shape of DayInputs changes: an older row is then left alone. */
const KEY = "day-inputs-v1";

export interface DayInputs {
  board: StandardsPayload;
  /** Per repo on the board: its history since the start of the day, and the push it was read at. `null` = not readable. */
  histories: Record<string, { pushed_at: string | null; history: History | null }>;
}

async function build(previous: DayInputs | null): Promise<DayInputs> {
  if (previous) {
    seedRepoStandards(previous.board);
    seedHistories(previous.histories);
  }
  const token = process.env.GITHUB_PAT;
  const board = await loadRepoStandards(fetch, token, Date.now, 0);
  const repos = board.repos ?? [];
  const read = token ? await mapLimited(repos, CONCURRENCY, (r) => historyOf(r, DAY.start, token, fetch).catch(() => null)) : repos.map(() => null);
  return { board, histories: Object.fromEntries(repos.map((r, i) => [r.name, { pushed_at: r.pushed_at, history: read[i] }])) };
}

// A board without a repo list, or one built from an earlier answer, is shown to the caller but never stored for everyone.
const day = snapshot<DayInputs>(KEY, { ttlMs: TTL_MS, usable: (v) => v.board.repos !== null && !v.board.stale }, build, databaseStore);

/** The board and the histories behind the leaderboard. Never throws. */
export const sharedInputs = (): Promise<DayInputs> => day.get();

/** The standards board. Never throws. */
export const sharedBoard = async (): Promise<StandardsPayload> => (await day.get()).board;

/** For a response header: where this instance's last answer came from ("shared", "built", "not-mine", ...) and its age. */
export const sharedInfo = (): string => {
  const { source, ageMs } = day.info();
  return ageMs === null ? source : `${source};age=${Math.round(ageMs / 1000)}`;
};

/** The histories as the leaderboard code wants them. */
export const historyMap = (inputs: DayInputs): Map<string, History | null> =>
  new Map(Object.entries(inputs.histories).map(([name, kept]) => [name, kept.history]));
