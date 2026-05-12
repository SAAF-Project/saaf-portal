import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { fetchMergedPRs, type PRCache } from "@/lib/github";
import { calculateScores, buildActivity } from "@/lib/scoring";
import type { Plan } from "@/types";
import { readFileSync } from "fs";
import { join } from "path";

let cachedData: {
  prCache: PRCache;
  timestamp: number;
} | null = null;

const CACHE_TTL = 60_000;

async function getCachedPRs(): Promise<PRCache> {
  if (cachedData && Date.now() - cachedData.timestamp < CACHE_TTL) {
    return cachedData.prCache;
  }
  const prCache = await fetchMergedPRs();
  cachedData = { prCache, timestamp: Date.now() };
  return prCache;
}

function loadPlansData(): Plan[] {
  try {
    const filePath = join(process.cwd(), "public", "data", "plans.json");
    return JSON.parse(readFileSync(filePath, "utf-8"));
  } catch {
    return [];
  }
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const filter = request.nextUrl.searchParams.get("filter") || "all";

  try {
    const prCache = await getCachedPRs();
    const plansData = loadPlansData();
    const scores = calculateScores(prCache, plansData, filter);
    const activity = buildActivity(prCache, filter);

    const totalPlanFiles = new Set<string>();
    for (const pr of Object.values(prCache)) {
      for (const f of pr.files) {
        if (
          /^plans\/.*\.md$/.test(f.filename) &&
          !f.filename.endsWith("README.md")
        ) {
          totalPlanFiles.add(f.filename);
        }
      }
    }

    return NextResponse.json({
      scores,
      activity,
      stats: {
        contributors: scores.length,
        mergedPRs: Object.keys(prCache).length,
        planFilesTouched: totalPlanFiles.size,
        totalPlans: plansData.length,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
