import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin";
import { forgetLeaderboard, loadLeaderboard } from "@/lib/leaderboard-load";
import { getState, overrideGrade, setState } from "@/lib/leaderboard-store";
import { getPrisma } from "@/lib/prisma";

export const maxDuration = 60;

// The organisers' view of the day's leaderboard: always the full, unfrozen standings, the grader's flags and the
// controls (freeze, reveal, disqualify, override a level). MSACC or the portal's admin token.
export async function GET(req: NextRequest) {
  if (!(await isAdminRequest(req))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json(await loadLeaderboard("admin"));
}

type Action =
  | { action: "freeze" | "unfreeze" | "reveal-next" | "reveal-back" | "reveal-reset" }
  | { action: "disqualify" | "requalify"; login: string }
  | { action: "override"; repo: string; tree: string; standard: string; level: number | null; note: string };

export async function POST(req: NextRequest) {
  if (!(await isAdminRequest(req))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = (await req.json().catch(() => null)) as Action | null;
  if (!body || typeof body.action !== "string") return NextResponse.json({ error: "Bad request" }, { status: 400 });
  const prisma = getPrisma();
  const now = await getState(prisma);
  switch (body.action) {
    case "freeze":
      await setState(prisma, { frozen: true, freezeAt: new Date().toISOString() });
      break;
    case "unfreeze":
      await setState(prisma, { frozen: false, freezeAt: null });
      break;
    case "reveal-next":
      await setState(prisma, { revealStep: now.revealStep + 1 });
      break;
    case "reveal-back":
      await setState(prisma, { revealStep: now.revealStep - 1 });
      break;
    case "reveal-reset":
      await setState(prisma, { revealStep: 0 });
      break;
    case "disqualify":
    case "requalify": {
      if (typeof body.login !== "string" || !/^[\w-]{1,40}(\[bot\])?$/.test(body.login)) return NextResponse.json({ error: "Bad login" }, { status: 400 });
      const set = new Set(now.disqualified);
      if (body.action === "disqualify") set.add(body.login);
      else set.delete(body.login);
      await setState(prisma, { disqualified: [...set].sort() });
      break;
    }
    case "override": {
      const { repo, tree, standard, level, note } = body;
      if (typeof repo !== "string" || typeof tree !== "string" || typeof standard !== "string" || (level !== null && !Number.isInteger(level))) {
        return NextResponse.json({ error: "Bad override" }, { status: 400 });
      }
      await overrideGrade(prisma, repo, tree, standard, level, typeof note === "string" ? note : "");
      break;
    }
    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
  forgetLeaderboard();
  return NextResponse.json(await loadLeaderboard("admin"));
}
