import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";

export function getObservabilityLevel(count: number): number {
  if (count >= 36) return 5;
  if (count >= 21) return 4;
  if (count >= 11) return 3;
  if (count >= 6) return 2;
  if (count >= 1) return 1;
  return 0;
}

export function getNextLevelAt(count: number): number | null {
  if (count < 1) return 1;
  if (count < 6) return 6;
  if (count < 11) return 11;
  if (count < 21) return 21;
  if (count < 36) return 36;
  return null;
}

const LEVEL_LABELS = ["None", "Bronze", "Silver", "Gold", "Platinum", "Diamond"];
const LEVEL_ICONS = ["", "🥉", "🥈", "🥇", "💎", "🏆"];

export { LEVEL_LABELS, LEVEL_ICONS };

export async function GET() {
  const session = await getServerSession(authOptions);
  const username = (session?.user as { githubUsername?: string })?.githubUsername;
  if (!username) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await getPrisma().user.findUnique({ where: { githubUsername: username } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const count = await getPrisma().observabilityCheck.count({ where: { userId: user.id } });
  const level = getObservabilityLevel(count);
  const nextLevelAt = getNextLevelAt(count);

  return NextResponse.json({
    observabilityCount: count,
    observabilityLevel: level,
    observabilityLabel: LEVEL_LABELS[level],
    observabilityIcon: LEVEL_ICONS[level],
    nextLevelAt,
  });
}
