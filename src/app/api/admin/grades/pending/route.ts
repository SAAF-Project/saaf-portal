import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin";
import { loadPending } from "@/lib/leaderboard-load";

export const maxDuration = 60;

// The review agent's to-do list: the states (repo and tree SHA) that have no levels yet. Admin only (the skill on
// Mathijs's Mac uses the portal's admin token).
export async function GET(req: NextRequest) {
  if (!(await isAdminRequest(req))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json({ states: await loadPending() });
}
