import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";
import { fetchMergedPRs } from "@/lib/github";

let cached: { data: ActivityStats; ts: number } | null = null;
const CACHE_TTL = 5 * 60_000;

interface ActivityStats {
  mergedPRs: number;
  newPlans: number;
  observabilityChecks: number;
  newParticipants: number;
  contributorCount: number;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return NextResponse.json(cached.data);
  }

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  let mergedPRs = 0;
  let newPlans = 0;
  const contributors = new Set<string>();

  try {
    const prCache = await fetchMergedPRs();
    for (const pr of Object.values(prCache)) {
      if (new Date(pr.merged_at) >= sevenDaysAgo) {
        mergedPRs++;
        contributors.add(pr.author);
        for (const f of pr.files) {
          if (/^plans\/.*\.md$/.test(f.filename) && f.status === "added") {
            newPlans++;
          }
        }
      }
    }
  } catch {}

  const observabilityChecks = await getPrisma().observabilityCheck.count({
    where: { createdAt: { gte: sevenDaysAgo } },
  });

  const newParticipants = await getPrisma().user.count({
    where: { createdAt: { gte: sevenDaysAgo } },
  });

  const data: ActivityStats = {
    mergedPRs,
    newPlans,
    observabilityChecks,
    newParticipants,
    contributorCount: contributors.size,
  };

  cached = { data, ts: Date.now() };
  return NextResponse.json(data);
}
