import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";
import { loadPlans, loadSubmitters } from "@/lib/progress-data";
import { suggestPlans } from "@/lib/plan-suggestions";
import { getUserPlans } from "@/lib/plan-match";
import type { Plan, Submitter, UserProfile } from "@/types";

export async function GET() {
  const session = await getServerSession(authOptions);
  const username = (session?.user as { githubUsername?: string })?.githubUsername;
  if (!username) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await getPrisma().user.findUnique({ where: { githubUsername: username } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const [plansLoaded, submittersLoaded] = await Promise.all([loadPlans(), loadSubmitters()]);
  const plans = plansLoaded.data as Plan[];
  const submitters = submittersLoaded.data as Submitter[];

  const userPlans = getUserPlans(plans, user as unknown as UserProfile, submitters);
  const userPlanSlugs = new Set(userPlans.map((p) => p.slug));
  const suggestions = suggestPlans(plans, user as unknown as UserProfile, userPlanSlugs);

  return NextResponse.json(suggestions);
}
