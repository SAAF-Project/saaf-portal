import { randomInt } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";
import { normaliseRepo, schedule, secondsPerTeam, shuffle } from "@/lib/demoDraw";

// Demo sign-up for the 10 November session. Teams register; at the end the admin draws the order
// at random and the 16:30-17:00 window is split evenly. Stored as Feedback rows (text = JSON),
// so no database migration is needed.
const TEAM_CATEGORY = "demo-2026-11";
const DRAW_CATEGORY = "demo-draw-2026-11";
// Sign-up closes at 16:15 Amsterdam time on 10 November 2026 (or once drawn), so the draw can happen before 16:30.
const LOCK_AT = new Date("2026-11-10T15:15:00Z");
const ADMIN_USERNAME = "MSACC";

interface TeamEntry {
  team: string;
  title: string;
  what: string;
  why: string;
  repo: string;
}


async function currentUsername(): Promise<string | undefined> {
  const session = await getServerSession(authOptions);
  return (session?.user as { githubUsername?: string })?.githubUsername;
}

function parseTeam(text: string): TeamEntry | null {
  try {
    const v = JSON.parse(text);
    if (typeof v.team === "string" && typeof v.title === "string") {
      const str = (x: unknown) => (typeof x === "string" ? x : "");
      return { team: v.team, title: v.title, what: str(v.what), why: str(v.why), repo: str(v.repo) };
    }
  } catch {
    /* ignore malformed rows */
  }
  return null;
}

function parseDraw(text: string): string[] | null {
  try {
    const v = JSON.parse(text);
    if (Array.isArray(v.order) && v.order.every((x: unknown) => typeof x === "string")) return v.order;
  } catch {
    /* ignore malformed rows */
  }
  return null;
}

function clean(value: unknown, max: number): string {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

const sameTeam = (a: string, b: string) => a.toLocaleLowerCase("en") === b.toLocaleLowerCase("en");

async function load() {
  const prisma = getPrisma();
  const rows = await prisma.feedback.findMany({
    where: { category: TEAM_CATEGORY },
    include: { user: { select: { githubUsername: true, name: true, organisation: true } } },
    orderBy: { createdAt: "asc" },
  });
  const teams = rows
    .map((r) => ({ id: r.id, userId: r.userId, entry: parseTeam(r.text), user: r.user, createdAt: r.createdAt }))
    .filter((r) => r.entry !== null) as {
    id: string;
    userId: string;
    entry: TeamEntry;
    user: { githubUsername: string; name: string | null; organisation: string | null };
    createdAt: Date;
  }[];
  const drawRow = await prisma.feedback.findFirst({ where: { category: DRAW_CATEGORY }, orderBy: { createdAt: "desc" } });
  const order = drawRow ? parseDraw(drawRow.text) : null;
  return { teams, order, drawnAt: drawRow?.createdAt ?? null };
}

function csvCell(value: unknown): string {
  let s = String(value ?? "");
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // no formulas when opened in a spreadsheet
  return `"${s.replace(/"/g, '""')}"`;
}

export async function GET(request: NextRequest) {
  const username = await currentUsername();
  if (!username) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const isAdmin = username === ADMIN_USERNAME;
  const { teams, order, drawnAt } = await load();

  const view = (t: (typeof teams)[number]) => {
    const mine = t.user.githubUsername === username;
    return {
      team: t.entry.team,
      title: t.entry.title,
      repo: t.entry.repo,
      mine,
      // What they built and why they should win are for the jury and the team itself.
      ...(isAdmin || mine ? { what: t.entry.what, why: t.entry.why } : {}),
      ...(isAdmin
        ? { id: t.id, githubUsername: t.user.githubUsername, name: t.user.name, organisation: t.user.organisation, createdAt: t.createdAt }
        : {}),
    };
  };

  // Admin export for the jury check: ?format=json or ?format=csv.
  const format = request.nextUrl.searchParams.get("format");
  if (format) {
    if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const rows = teams.map((t) => ({
      team: t.entry.team,
      guard: t.entry.title,
      what: t.entry.what,
      why: t.entry.why,
      repo: t.entry.repo,
      githubUsername: t.user.githubUsername,
      organisation: t.user.organisation ?? "",
      createdAt: t.createdAt.toISOString(),
    }));
    if (format === "csv") {
      const head = ["team", "guard", "what", "why", "repo", "githubUsername", "organisation", "createdAt"] as const;
      const body = [head.join(","), ...rows.map((r) => head.map((h) => csvCell(r[h])).join(","))].join("\n");
      return new NextResponse(body, {
        headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="demo-teams-2026-11.csv"' },
      });
    }
    return NextResponse.json(rows);
  }

  // The schedule follows the drawn order; teams removed after the draw drop out of it.
  const drawn = order ? order.map((id) => teams.find((t) => t.id === id)).filter((t) => t !== undefined) : null;
  const plan = drawn ? schedule(drawn) : null;

  return NextResponse.json({
    locked: Date.now() >= LOCK_AT.getTime() || order !== null,
    drawn: order !== null,
    drawnAt,
    secondsPerTeam: plan ? plan.seconds : secondsPerTeam(teams.length),
    teams: teams.map(view),
    schedule: plan ? plan.slots.map((s) => ({ start: s.start, end: s.end, ...view(s.item) })) : null,
  });
}

export async function POST(request: NextRequest) {
  const username = await currentUsername();
  if (!username) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const prisma = getPrisma();
  const user = await prisma.user.findUnique({ where: { githubUsername: username } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
  const body = await request.json().catch(() => ({}));
  const { teams, order } = await load();

  if (body.action === "draw") {
    // Admin: draw the order at random. Drawing again replaces the previous draw.
    if (username !== ADMIN_USERNAME) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (teams.length === 0) return NextResponse.json({ error: "No teams have signed up yet" }, { status: 400 });
    const ids = shuffle(
      teams.map((t) => t.id),
      (max) => randomInt(max),
    );
    await prisma.feedback.deleteMany({ where: { category: DRAW_CATEGORY } });
    await prisma.feedback.create({
      data: { userId: user.id, category: DRAW_CATEGORY, text: JSON.stringify({ order: ids }), status: "reviewed" },
    });
    return NextResponse.json({ drawn: true, teams: ids.length });
  }

  if (order !== null) return NextResponse.json({ error: "The slots have been drawn. Ask an organiser." }, { status: 400 });
  if (Date.now() >= LOCK_AT.getTime()) return NextResponse.json({ error: "Sign-up is closed" }, { status: 400 });

  const team = clean(body.team, 60);
  const title = clean(body.title, 100);
  const what = clean(body.what, 600);
  const why = clean(body.why, 400);
  const repo = normaliseRepo(body.repo);
  if (team.length < 2 || title.length < 3) {
    return NextResponse.json({ error: "Enter a team name and the name of your guard" }, { status: 400 });
  }
  if (what.length < 20) return NextResponse.json({ error: "Describe in a sentence or two what you built" }, { status: 400 });
  if (why.length < 10) return NextResponse.json({ error: "Tell the jury why you should win" }, { status: 400 });
  if (repo === null) {
    return NextResponse.json({ error: "The repository must be in the SAAF-Project org, e.g. SAAF-Project/my-guard" }, { status: 400 });
  }
  const taken = teams.find((t) => sameTeam(t.entry.team, team) && t.userId !== user.id);
  if (taken) {
    return NextResponse.json(
      { error: `${taken.entry.team} is already signed up by @${taken.user.githubUsername}. One sign-up per team.` },
      { status: 409 },
    );
  }
  const mine = teams.find((t) => t.userId === user.id);
  const text = JSON.stringify({ team, title, what, why, repo });
  if (mine) {
    await prisma.feedback.update({ where: { id: mine.id }, data: { text } });
  } else {
    await prisma.feedback.create({ data: { userId: user.id, category: TEAM_CATEGORY, text, status: "reviewed" } });
  }
  return NextResponse.json({ team, title, what, why, repo });
}

export async function DELETE(request: NextRequest) {
  const username = await currentUsername();
  if (!username) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const prisma = getPrisma();
  const params = request.nextUrl.searchParams;
  const id = params.get("id");
  const clearDraw = params.get("draw") !== null;

  if (clearDraw || id) {
    if (username !== ADMIN_USERNAME) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (clearDraw) {
      // Admin clears the draw: sign-up opens again (until 16:15).
      await prisma.feedback.deleteMany({ where: { category: DRAW_CATEGORY } });
      return NextResponse.json({ cleared: true });
    }
    const row = await prisma.feedback.findUnique({ where: { id: id! } });
    if (!row || row.category !== TEAM_CATEGORY) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await prisma.feedback.delete({ where: { id: id! } });
    return NextResponse.json({ removed: true });
  }

  // A member withdraws their own team, only before the draw.
  const { order } = await load();
  if (order !== null) return NextResponse.json({ error: "The slots have been drawn. Ask an organiser." }, { status: 400 });
  const user = await prisma.user.findUnique({ where: { githubUsername: username } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
  await prisma.feedback.deleteMany({ where: { category: TEAM_CATEGORY, userId: user.id } });
  return NextResponse.json({ removed: true });
}
