import { randomInt } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";
import { isRole, makeTeams, placeLate, type Role } from "@/lib/teams";

// Team matching for the 10 November challenge. Members say hacker, developer or auditor; the admin makes
// mixed teams. Stored as Feedback rows (role = text, teams = JSON), so no database migration is needed.
const ROLE_CATEGORY = "role-2026-11";
const TEAMS_CATEGORY = "teams-2026-11";
const ADMIN_USERNAME = "MSACC";

async function currentUsername(): Promise<string | undefined> {
  const session = await getServerSession(authOptions);
  return (session?.user as { githubUsername?: string })?.githubUsername;
}

function parseTeams(text: string): string[][] | null {
  try {
    const v = JSON.parse(text);
    if (Array.isArray(v.teams) && v.teams.every((t: unknown) => Array.isArray(t) && t.every((x) => typeof x === "string"))) {
      return v.teams;
    }
  } catch {
    /* ignore malformed rows */
  }
  return null;
}

async function load() {
  const prisma = getPrisma();
  const rows = await prisma.feedback.findMany({
    where: { category: ROLE_CATEGORY },
    include: { user: { select: { githubUsername: true, name: true, organisation: true } } },
    orderBy: { createdAt: "asc" },
  });
  const people = rows
    .filter((r) => isRole(r.text))
    .map((r) => ({ userId: r.userId, role: r.text as Role, ...r.user }));
  const teamsRow = await prisma.feedback.findFirst({ where: { category: TEAMS_CATEGORY }, orderBy: { createdAt: "desc" } });
  return { people, teams: teamsRow ? parseTeams(teamsRow.text) : null, teamsRow };
}

export async function GET() {
  const username = await currentUsername();
  if (!username) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { people, teams, teamsRow } = await load();
  const byId = new Map(people.map((p) => [p.userId, p]));
  const me = people.find((p) => p.githubUsername === username);
  const shown = (teams ?? []).map((ids, i) => ({
    number: i + 1,
    members: ids
      .map((id) => byId.get(id))
      .filter((p) => p !== undefined)
      .map((p) => ({ githubUsername: p.githubUsername, name: p.name, organisation: p.organisation, role: p.role })),
  }));
  const placed = new Set((teams ?? []).flat());
  return NextResponse.json({
    role: me?.role ?? null,
    counts: {
      hacker: people.filter((p) => p.role === "hacker").length,
      dev: people.filter((p) => p.role === "dev").length,
      auditor: people.filter((p) => p.role === "auditor").length,
    },
    drawn: teams !== null,
    drawnAt: teamsRow?.createdAt ?? null,
    myTeam: me ? (shown.find((t) => t.members.some((m) => m.githubUsername === username)) ?? null) : null,
    teams: shown,
    waiting: teams ? people.filter((p) => !placed.has(p.userId)).length : 0,
  });
}

export async function POST(request: NextRequest) {
  const username = await currentUsername();
  if (!username) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const prisma = getPrisma();
  const user = await prisma.user.findUnique({ where: { githubUsername: username } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
  const body = await request.json().catch(() => ({}));

  if (body.action === "draw" || body.action === "late") {
    if (username !== ADMIN_USERNAME) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const { people, teams } = await load();
    if (people.length === 0) return NextResponse.json({ error: "Nobody has picked a role yet" }, { status: 400 });
    let next: string[][];
    if (body.action === "draw" || teams === null) {
      next = makeTeams(people.map((p) => ({ id: p.userId, role: p.role })), (max) => randomInt(max));
    } else {
      // Add everyone who picked a role after the teams were made, one by one.
      next = teams.map((t) => [...t]);
      const roleOf = (id: string) => people.find((p) => p.userId === id)?.role;
      const placed = new Set(next.flat());
      for (const p of people.filter((x) => !placed.has(x.userId))) {
        next[placeLate(next, roleOf, { id: p.userId, role: p.role })].push(p.userId);
      }
    }
    await prisma.feedback.deleteMany({ where: { category: TEAMS_CATEGORY } });
    await prisma.feedback.create({
      data: { userId: user.id, category: TEAMS_CATEGORY, text: JSON.stringify({ teams: next }), status: "reviewed" },
    });
    return NextResponse.json({ teams: next.length });
  }

  if (!isRole(body.role)) return NextResponse.json({ error: "Choose hacker, developer or auditor" }, { status: 400 });
  const existing = await prisma.feedback.findFirst({ where: { category: ROLE_CATEGORY, userId: user.id } });
  if (existing) {
    await prisma.feedback.update({ where: { id: existing.id }, data: { text: body.role } });
  } else {
    await prisma.feedback.create({ data: { userId: user.id, category: ROLE_CATEGORY, text: body.role, status: "reviewed" } });
  }
  return NextResponse.json({ role: body.role });
}

export async function DELETE() {
  const username = await currentUsername();
  if (!username) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (username !== ADMIN_USERNAME) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  await getPrisma().feedback.deleteMany({ where: { category: TEAMS_CATEGORY } });
  return NextResponse.json({ cleared: true });
}
