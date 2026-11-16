import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { loadLeaderboard } from "@/lib/leaderboard-load";

// Reading the day back from history takes a few calls per repo the first time on a server instance.
export const maxDuration = 60;

// The day's leaderboard for the public board (src/lib/leaderboard-day.ts): frozen from 15:15, then revealed place by
// place by the organisers. Signed-in members only: it names private repos.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await loadLeaderboard("public"));
}
