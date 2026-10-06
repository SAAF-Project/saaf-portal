import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";
import { fetchAgentLibrary, repoHasAuditCriteria } from "@/lib/github";
import type { ReadinessRepo, ClaimRole } from "@/types";

const ROLES: ClaimRole[] = ["dev", "auditor"];
const MAX_TEAM_SIZE = 6;
const MAX_CLAIMS_PER_USER = 2;

// GitHub-derived part is slow (README + AUDIT-CRITERIA per repo) → cache it.
// Claims are read fresh from the DB on every request.
let repoCache: {
  data: Omit<ReadinessRepo, "claim">[];
  ts: number;
} | null = null;
const REPO_CACHE_TTL = 10 * 60_000;

async function loadRepos(): Promise<Omit<ReadinessRepo, "claim">[]> {
  if (repoCache && Date.now() - repoCache.ts < REPO_CACHE_TTL) return repoCache.data;
  const agents = await fetchAgentLibrary();
  const data = await Promise.all(
    agents.map(async (a) => {
      const hasAuditCriteria = await repoHasAuditCriteria(a.name);
      const reviewed = a.status === "reviewed";
      return {
        name: a.name,
        description: a.description,
        htmlUrl: a.htmlUrl,
        language: a.language,
        libraryStatus: a.status,
        reviewed,
        hasAuditCriteria,
        ready: reviewed && hasAuditCriteria,
      };
    })
  );
  repoCache = { data, ts: Date.now() };
  return data;
}

async function currentUser() {
  const session = await getServerSession(authOptions);
  const username = (session?.user as { githubUsername?: string })?.githubUsername;
  if (!username) return null;
  return getPrisma().user.findUnique({ where: { githubUsername: username } });
}

function badRequest(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return badRequest("Unauthorized", 401);

  try {
    const [repos, claims] = await Promise.all([
      loadRepos(),
      getPrisma().repoClaim.findMany({
        include: {
          members: {
            include: { user: { select: { githubUsername: true, name: true, avatarUrl: true } } },
            orderBy: { createdAt: "asc" },
          },
        },
      }),
    ]);
    const byRepo = new Map(claims.map((c) => [c.repo, c]));

    const result: ReadinessRepo[] = repos.map((r) => {
      const c = byRepo.get(r.name);
      return {
        ...r,
        claim: c
          ? {
              prUrl: c.prUrl,
              members: c.members.map((m) => ({
                username: m.user.githubUsername,
                name: m.user.name,
                avatarUrl: m.user.avatarUrl,
                role: m.role as ClaimRole,
              })),
            }
          : null,
      };
    });

    return NextResponse.json(result);
  } catch (e) {
    return badRequest(e instanceof Error ? e.message : "Failed", 500);
  }
}

// Claim a repo (creates the claim) or join an existing team.
export async function POST(request: NextRequest) {
  const user = await currentUser();
  if (!user) return badRequest("Unauthorized", 401);

  const body = await request.json();
  const repo = String(body.repo || "");
  const role = body.role as ClaimRole;
  if (!ROLES.includes(role)) return badRequest("Role must be 'dev' or 'auditor'");

  const repos = await loadRepos();
  if (!repos.some((r) => r.name === repo)) return badRequest("Unknown agent repo", 404);

  const prisma = getPrisma();
  const myClaims = await prisma.repoClaimMember.count({ where: { userId: user.id } });
  if (myClaims >= MAX_CLAIMS_PER_USER) {
    return badRequest(`You can be on at most ${MAX_CLAIMS_PER_USER} teams — leave one first`);
  }

  const claim = await prisma.repoClaim.upsert({
    where: { repo },
    create: { repo },
    update: {},
    include: { members: true },
  });
  if (claim.members.some((m) => m.userId === user.id)) return badRequest("You're already on this team");
  if (claim.members.length >= MAX_TEAM_SIZE) return badRequest("This team is full");

  await prisma.repoClaimMember.create({ data: { claimId: claim.id, userId: user.id, role } });
  return NextResponse.json({ ok: true });
}

// Team members can attach the hardening PR link.
export async function PATCH(request: NextRequest) {
  const user = await currentUser();
  if (!user) return badRequest("Unauthorized", 401);

  const body = await request.json();
  const repo = String(body.repo || "");
  const prUrl = String(body.prUrl || "").trim();
  if (prUrl && !prUrl.startsWith(`https://github.com/SAAF-Project/${repo}/pull/`)) {
    return badRequest(`PR link must look like https://github.com/SAAF-Project/${repo}/pull/<n>`);
  }

  const prisma = getPrisma();
  const claim = await prisma.repoClaim.findUnique({ where: { repo }, include: { members: true } });
  if (!claim || !claim.members.some((m) => m.userId === user.id)) {
    return badRequest("Only team members can update this claim", 403);
  }

  await prisma.repoClaim.update({ where: { repo }, data: { prUrl: prUrl || null } });
  return NextResponse.json({ ok: true });
}

// Leave a team; the claim is released when the last member leaves.
export async function DELETE(request: NextRequest) {
  const user = await currentUser();
  if (!user) return badRequest("Unauthorized", 401);

  const repo = request.nextUrl.searchParams.get("repo") || "";
  const prisma = getPrisma();
  const claim = await prisma.repoClaim.findUnique({ where: { repo } });
  if (!claim) return badRequest("No claim on this repo", 404);

  await prisma.repoClaimMember.deleteMany({ where: { claimId: claim.id, userId: user.id } });
  const remaining = await prisma.repoClaimMember.count({ where: { claimId: claim.id } });
  if (remaining === 0) await prisma.repoClaim.delete({ where: { id: claim.id } });

  return NextResponse.json({ ok: true });
}
