import { NextRequest, NextResponse } from "next/server";
import { isGrader, loadPending } from "@/lib/leaderboard-load";

export const maxDuration = 60;

// The grader's to-do list: the states (repo and tree SHA) that have no levels yet. For the private grader skill on
// Mathijs's Mac, with the GRADER_TOKEN; no session.
export async function GET(req: NextRequest) {
  if (!isGrader(req.headers.get("authorization"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json({ states: await loadPending() });
}
