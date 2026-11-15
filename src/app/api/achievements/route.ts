import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";
import { computeBadge, BADGE_KEYS } from "@/lib/achievements";
import { fetchMergedPRs } from "@/lib/github";
import { calculateScores } from "@/lib/scoring";
import type { Plan } from "@/types";
import { loadPlans } from "@/lib/progress-data";
import { loadRevived } from "@/lib/revived";

let cachedScores: { data: ReturnType<typeof calculateScores>; ts: number } | null = null;
const CACHE_TTL = 60_000;

async function getScores() {
  if (cachedScores && Date.now() - cachedScores.ts < CACHE_TTL) {
    return cachedScores.data;
  }
  const prCache = await fetchMergedPRs();
  const plansData = (await loadPlans()).data as Plan[];
  const data = calculateScores(prCache, plansData, "all");
  cachedScores = { data, ts: Date.now() };
  return data;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  const username = (session?.user as { githubUsername?: string })?.githubUsername;
  if (!username) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await getPrisma().user.findUnique({ where: { githubUsername: username } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const observabilityCount = await getPrisma().observabilityCheck.count({ where: { userId: user.id } });

  // Each lookup may fail on its own: a badge then shows 0 for now, and the other badges are not affected.
  const [scoreEntry, revived] = await Promise.all([
    getScores()
      .then((scores) => scores.find((s) => s.login === username))
      .catch(() => undefined),
    // The agent repos this member revived (src/lib/revived.ts). The member is their owner, so they may see the names.
    loadRevived(username).catch((): string[] => []),
  ]);

  const counts: Record<string, number> = {
    observability: observabilityCount,
    mergedPRs: scoreEntry?.prs ?? 0,
    newPlans: scoreEntry?.newPlans ?? 0,
    planUpdates: scoreEntry?.updateCount ?? 0,
    claims: scoreEntry?.claims ?? 0,
    revived: revived.length,
  };

  const badges = BADGE_KEYS.map((key) => computeBadge(key, counts[key]));

  return NextResponse.json({ badges, revived });
}
