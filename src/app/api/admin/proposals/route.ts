import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin";
import { forgetLeaderboard } from "@/lib/leaderboard-load";
import { loadProposals, saveProposals, validateProposals } from "@/lib/leaderboard-store";
import { getPrisma } from "@/lib/prisma";

// Scores of the standards review (private skill on Mathijs's Mac) for proposals to improve the standards. Advice for
// the organisers: nothing is merged on the day. MSACC or the portal's admin token.
export async function GET(request: NextRequest) {
  if (!(await isAdminRequest(request))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json({ proposals: await loadProposals(getPrisma()) });
}

export async function POST(request: NextRequest) {
  if (!(await isAdminRequest(request))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = (await request.json().catch(() => null)) as { proposals?: unknown } | null;
  const { ok, errors } = validateProposals(body?.proposals);
  const saved = ok.length > 0 ? await saveProposals(getPrisma(), ok) : 0;
  forgetLeaderboard();
  return NextResponse.json({ saved, refused: errors });
}
