import { getServerSession } from "next-auth";
import { authOptions } from "./auth";
import { buildLeaderboard, DAY, frozenAt, isFrozen, pendingStates, type LeaderboardPayload } from "./leaderboard-day";
import { getState, loadGrades, type BoardState, type Graded } from "./leaderboard-store";
import { getPrisma } from "./prisma";
import { mapLimited } from "./repo-signals";
import { loadRepoStandards, type StandardsPayload } from "./repo-standards";
import { historyOf, type History } from "./standards-prizes";

// Server side of the day's leaderboard: gathers the board, the history of every repo (src/lib/standards-prizes.ts),
// the grader's levels and the organisers' controls (src/lib/leaderboard-store.ts), and hands them to
// buildLeaderboard (src/lib/leaderboard-day.ts). Also the two guards: the admin (MSACC) and the grader's token.

const ADMIN_USERNAME = "MSACC";
const CONCURRENCY = 6;
const TTL_MS = 30_000;

export async function isAdmin(): Promise<boolean> {
  const session = await getServerSession(authOptions);
  return (session?.user as { githubUsername?: string } | undefined)?.githubUsername === ADMIN_USERNAME;
}

export { isGrader } from "./grader-auth";

async function histories(board: StandardsPayload): Promise<Map<string, History | null>> {
  const token = process.env.GITHUB_PAT;
  const repos = board.repos ?? [];
  if (!token) return new Map(repos.map((r) => [r.name, null]));
  const hs = await mapLimited(repos, CONCURRENCY, (r) => historyOf(r, DAY.start, token, fetch).catch(() => null));
  return new Map(repos.map((r, i) => [r.name, hs[i]]));
}

async function grades(state: BoardState, now: string): Promise<{ frozen: Map<string, Graded>; all: Map<string, Graded> }> {
  try {
    const prisma = getPrisma();
    const all = await loadGrades(prisma);
    const frozen = isFrozen(now, state) ? await loadGrades(prisma, new Date(frozenAt(state))) : all;
    return { frozen, all };
  } catch {
    return { frozen: new Map(), all: new Map() };
  }
}

async function state(): Promise<BoardState> {
  try {
    return await getState(getPrisma());
  } catch {
    return { frozen: false, freezeAt: null, revealStep: 0, disqualified: [] };
  }
}

const memo = new Map<string, { at: number; value: Promise<LeaderboardPayload> }>();

/** The leaderboard for the public board or the admin. Never throws; at most once per 30 seconds per view and instance. */
export function loadLeaderboard(view: "public" | "admin", now: () => number = Date.now): Promise<LeaderboardPayload> {
  const kept = memo.get(view);
  if (kept && now() - kept.at < TTL_MS) return kept.value;
  const value = (async () => {
    const nowIso = new Date(now()).toISOString();
    const board = await loadRepoStandards();
    const [hs, st] = await Promise.all([histories(board), state()]);
    const gs = await grades(st, nowIso);
    return buildLeaderboard({ board, histories: hs, grades: gs.frozen, allGrades: gs.all, state: st, now: nowIso, view });
  })();
  memo.set(view, { at: now(), value });
  value.catch(() => memo.delete(view));
  return value;
}

/** After the organisers change something, show it at once. */
export function forgetLeaderboard(): void {
  memo.clear();
}

/** The grader's to-do list: every state of every repo that has no full set of levels yet. */
export async function loadPending(): Promise<{ repo: string; tree: string; at: string | null }[]> {
  const board = await loadRepoStandards();
  const hs = await histories(board);
  const { all } = await grades({ frozen: false, freezeAt: null, revealStep: 0, disqualified: [] }, new Date().toISOString());
  return pendingStates(board, hs, all);
}
