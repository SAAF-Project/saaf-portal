import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin";
import { forgetLeaderboard } from "@/lib/leaderboard-load";
import { saveGrades, validateGrades } from "@/lib/leaderboard-store";
import { getPrisma } from "@/lib/prisma";

// One run of the private review agent: levels per repo, tree SHA and standard. Admin only (the skill uses the portal's
// admin token). Rows that do not validate
// are refused by name; the rest is saved.
export async function POST(req: NextRequest) {
  if (!(await isAdminRequest(req))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = (await req.json().catch(() => null)) as { runId?: unknown; grades?: unknown } | null;
  if (!body || typeof body.runId !== "string" || !/^[\w:.-]{1,60}$/.test(body.runId)) return NextResponse.json({ error: "runId" }, { status: 400 });
  const { ok, errors } = validateGrades(body.grades);
  if (ok.length > 2000) return NextResponse.json({ error: "Too many rows in one run" }, { status: 413 });
  const saved = ok.length > 0 ? await saveGrades(getPrisma(), body.runId, ok) : 0;
  forgetLeaderboard();
  return NextResponse.json({ saved, refused: errors });
}
