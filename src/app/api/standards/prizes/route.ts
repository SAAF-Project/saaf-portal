import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { loadRepoStandards } from "@/lib/repo-standards";
import { loadPrizes } from "@/lib/standards-prizes";

// Reading the start of the day back from history takes a few calls per repo the first time on a server instance.
export const maxDuration = 60;

// The prizes of the hardening day, worked out from the board and GitHub's history (src/lib/standards-prizes.ts).
// Signed-in members only: the answer names private repos.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return NextResponse.json(await loadPrizes(await loadRepoStandards()));
}
