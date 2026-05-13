import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";

async function getSessionUser() {
  const session = await getServerSession(authOptions);
  const username = (session?.user as { githubUsername?: string })?.githubUsername;
  if (!username) return null;
  return getPrisma().user.findUnique({ where: { githubUsername: username } });
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const planSlug = request.nextUrl.searchParams.get("planSlug");
  if (!planSlug) return NextResponse.json({ error: "planSlug required" }, { status: 400 });

  const checks = await getPrisma().observabilityCheck.findMany({
    where: { planSlug },
    include: { user: { select: { name: true, githubUsername: true, avatarUrl: true, organisation: true } } },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json(checks);
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { planSlug, purpose, usersStakeholders, workflow, criticalDecisions,
    failureModes, observabilityFields, controls, auditEvidence, alertsTriggers, successMetrics } = body;

  if (!planSlug) return NextResponse.json({ error: "planSlug required" }, { status: 400 });

  const check = await getPrisma().observabilityCheck.upsert({
    where: { planSlug_userId: { planSlug, userId: user.id } },
    create: {
      planSlug,
      userId: user.id,
      purpose: purpose || "",
      usersStakeholders: usersStakeholders || "",
      workflow: workflow || "",
      criticalDecisions: criticalDecisions || "",
      failureModes: failureModes || "",
      observabilityFields: observabilityFields || "",
      controls: controls || "",
      auditEvidence: auditEvidence || "",
      alertsTriggers: alertsTriggers || "",
      successMetrics: successMetrics || "",
    },
    update: {
      purpose: purpose || "",
      usersStakeholders: usersStakeholders || "",
      workflow: workflow || "",
      criticalDecisions: criticalDecisions || "",
      failureModes: failureModes || "",
      observabilityFields: observabilityFields || "",
      controls: controls || "",
      auditEvidence: auditEvidence || "",
      alertsTriggers: alertsTriggers || "",
      successMetrics: successMetrics || "",
    },
  });

  const count = await getPrisma().observabilityCheck.count({ where: { userId: user.id } });

  return NextResponse.json({ check, totalCount: count });
}
