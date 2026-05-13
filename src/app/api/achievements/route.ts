import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";
import { computeBadge, BADGE_KEYS } from "@/lib/achievements";
import { fetchMergedPRs } from "@/lib/github";
import { calculateScores } from "@/lib/scoring";
import type { Plan } from "@/types";
import { readFileSync } from "fs";
import { join } from "path";

let cachedScores: { data: ReturnType<typeof calculateScores>; ts: number } | null = null;
const CACHE_TTL = 60_000;

async function getScores() {
  if (cachedScores && Date.now() - cachedScores.ts < CACHE_TTL) {
    return cachedScores.data;
  }
  const prCache = await fetchMergedPRs();
  let plansData: Plan[] = [];
  try {
    const filePath = join(process.cwd(), "public", "data", "plans.json");
    plansData = JSON.parse(readFileSync(filePath, "utf-8"));
  } catch {}
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

  let scoreEntry: ReturnType<typeof calculateScores>[0] | undefined;
  try {
    const scores = await getScores();
    scoreEntry = scores.find((s) => s.login === username);
  } catch {}

  const counts: Record<string, number> = {
    observability: observabilityCount,
    mergedPRs: scoreEntry?.prs ?? 0,
    newPlans: scoreEntry?.newPlans ?? 0,
    planUpdates: scoreEntry?.updateCount ?? 0,
    claims: scoreEntry?.claims ?? 0,
  };

  const badges = BADGE_KEYS.map((key) => computeBadge(key, counts[key]));

  return NextResponse.json({ badges });
}
