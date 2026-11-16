import { buildLeaderboard, frozenAt, isFrozen, pendingStates, type LeaderboardPayload } from "./leaderboard-day";
import { getState, loadGrades, loadProposals, type BoardState, type Graded, type Proposal } from "./leaderboard-store";
import { getPrisma } from "./prisma";
import { historyMap, sharedInputs } from "./shared-loaders";

// Server side of the day's leaderboard: takes the board and the history of every repo from the shared snapshot
// (src/lib/shared-loaders.ts), adds the grader's levels and the organisers' controls from the database
// (src/lib/leaderboard-store.ts), and hands them to buildLeaderboard (src/lib/leaderboard-day.ts).
//
// Nothing here calls GitHub. Per server instance the result is kept for ten seconds per view and per state of the
// organisers' controls, and the controls are read again every two seconds: a freeze or a reveal step therefore shows on
// every instance within seconds, without anyone having to tell the other instances.

const TTL_MS = 10_000;
const STATE_MS = 2_000;
const NO_STATE: BoardState = { frozen: false, freezeAt: null, revealStep: 0, disqualified: [] };

async function grades(state: BoardState, now: string): Promise<{ frozen: Map<string, Graded>; all: Map<string, Graded>; proposals: Proposal[]; allProposals: Proposal[] }> {
  try {
    const prisma = getPrisma();
    const all = await loadGrades(prisma);
    const allProposals = await loadProposals(prisma);
    const until = frozenAt(state);
    const frozenNow = isFrozen(now, state);
    const frozen = frozenNow ? await loadGrades(prisma, new Date(until)) : all;
    const proposals = frozenNow ? allProposals.filter((p) => p.gradedAt <= until) : allProposals;
    return { frozen, all, proposals, allProposals };
  } catch {
    return { frozen: new Map(), all: new Map(), proposals: [], allProposals: [] };
  }
}

let stateMemo: { at: number; value: Promise<BoardState> } | null = null;

function currentState(now: () => number): Promise<BoardState> {
  if (stateMemo && now() - stateMemo.at < STATE_MS) return stateMemo.value;
  const value = (async () => {
    try {
      return await getState(getPrisma());
    } catch {
      return NO_STATE;
    }
  })();
  stateMemo = { at: now(), value };
  return value;
}

const memo = new Map<string, { at: number; value: Promise<LeaderboardPayload> }>();

/** The leaderboard for the public board or the admin. Never throws. */
export async function loadLeaderboard(view: "public" | "admin", now: () => number = Date.now): Promise<LeaderboardPayload> {
  const st = await currentState(now);
  const key = `${view}:${JSON.stringify(st)}`;
  const kept = memo.get(key);
  if (kept && now() - kept.at < TTL_MS) return kept.value;
  for (const [k, v] of memo) if (now() - v.at >= TTL_MS) memo.delete(k);
  const value = (async () => {
    const nowIso = new Date(now()).toISOString();
    const inputs = await sharedInputs();
    const gs = await grades(st, nowIso);
    return buildLeaderboard({ board: inputs.board, histories: historyMap(inputs), grades: gs.frozen, allGrades: gs.all, proposals: gs.proposals, allProposals: gs.allProposals, state: st, now: nowIso, view });
  })();
  memo.set(key, { at: now(), value });
  value.catch(() => memo.delete(key));
  return value;
}

/** After the organisers or the grader change something, show it at once on this instance. */
export function forgetLeaderboard(): void {
  memo.clear();
  stateMemo = null;
}

/** The grader's to-do list: every state of every repo that has no full set of levels yet. */
export async function loadPending(): Promise<{ repo: string; tree: string; at: string | null }[]> {
  const inputs = await sharedInputs();
  const { all } = await grades(NO_STATE, new Date().toISOString());
  return pendingStates(inputs.board, historyMap(inputs), all);
}
