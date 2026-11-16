import { randomInt } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest, sessionLogin } from "@/lib/admin";
import { trackOfKind } from "@/lib/day-tracks";
import { demoSession, isDemoKind, normaliseLink, overKind, type DemoKind, type DemoSession } from "@/lib/demo-sessions";
import { normaliseRepo, schedule, secondsPerTeam, shuffle } from "@/lib/demoDraw";
import { getPrisma } from "@/lib/prisma";

// Demo sign-up per session (src/lib/demo-sessions.ts). Teams register until the session's close; then the organisers
// either draw the order at random (10 November) or select at most a few teams for fixed slots (17 November). Stored as
// Feedback rows (text = JSON) under the session's own category, so no migration is needed and old sessions stay.
// The admin (MSACC, or the portal's admin token for the pitch check) sees everything: ?session=<id>&format=json|csv.

interface Entry {
  team: string;
  title: string;
  what: string;
  why: string;
  repo: string;
  kind: DemoKind | "";
  link: string;
}

function parseEntry(text: string): Entry | null {
  try {
    const v = JSON.parse(text);
    if (typeof v.team === "string" && typeof v.title === "string") {
      const str = (x: unknown) => (typeof x === "string" ? x : "");
      const kind = isDemoKind(v.kind) ? v.kind : "";
      return { team: v.team, title: v.title, what: str(v.what), why: str(v.why), repo: str(v.repo), kind, link: str(v.link) };
    }
  } catch {
    /* ignore malformed rows */
  }
  return null;
}

function parseOrder(text: string): string[] | null {
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

async function load(s: DemoSession) {
  const prisma = getPrisma();
  const rows = await prisma.feedback.findMany({
    where: { category: s.category },
    include: { user: { select: { githubUsername: true, name: true, organisation: true } } },
    orderBy: { createdAt: "asc" },
  });
  const teams = rows
    .map((r) => ({ id: r.id, userId: r.userId, entry: parseEntry(r.text), user: r.user, createdAt: r.createdAt }))
    .filter((r) => r.entry !== null) as {
    id: string;
    userId: string;
    entry: Entry;
    user: { githubUsername: string; name: string | null; organisation: string | null };
    createdAt: Date;
  }[];
  const orderRow = await prisma.feedback.findFirst({ where: { category: s.orderCategory }, orderBy: { createdAt: "desc" } });
  const order = orderRow ? parseOrder(orderRow.text) : null;
  return { teams, order, orderedAt: orderRow?.createdAt ?? null };
}

function csvCell(value: unknown): string {
  let s = String(value ?? "");
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // no formulas when opened in a spreadsheet
  return `"${s.replace(/"/g, '""')}"`;
}

const locked = (s: DemoSession, order: string[] | null) => Date.now() >= Date.parse(s.lockAt) || order !== null;

export async function GET(request: NextRequest) {
  const s = demoSession(request.nextUrl.searchParams.get("session"));
  if (!s) return NextResponse.json({ error: "Unknown session" }, { status: 404 });
  const isAdmin = await isAdminRequest(request);
  const username = await sessionLogin();
  if (!username && !isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { teams, order, orderedAt } = await load(s);

  const view = (t: (typeof teams)[number]) => {
    const mine = t.user.githubUsername === username;
    return {
      team: t.entry.team,
      title: t.entry.title,
      repo: t.entry.repo,
      kind: t.entry.kind,
      link: t.entry.link,
      mine,
      // The lesson and the pitch are for the organisers and the team itself.
      ...(isAdmin || mine ? { what: t.entry.what, why: t.entry.why } : {}),
      ...(isAdmin
        ? { id: t.id, githubUsername: t.user.githubUsername, name: t.user.name, organisation: t.user.organisation, createdAt: t.createdAt }
        : {}),
    };
  };

  // Admin export for the jury and pitch checks: ?format=json or ?format=csv.
  const format = request.nextUrl.searchParams.get("format");
  if (format) {
    if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const rows = teams.map((t) => ({
      id: t.id,
      team: t.entry.team,
      title: t.entry.title,
      kind: t.entry.kind,
      what: t.entry.what,
      why: t.entry.why,
      repo: t.entry.repo,
      link: t.entry.link,
      githubUsername: t.user.githubUsername,
      organisation: t.user.organisation ?? "",
      createdAt: t.createdAt.toISOString(),
    }));
    if (format === "csv") {
      const head = ["team", "title", "kind", "what", "why", "repo", "link", "githubUsername", "organisation", "createdAt"] as const;
      const body = [head.join(","), ...rows.map((r) => head.map((h) => csvCell(r[h])).join(","))].join("\n");
      return new NextResponse(body, {
        headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="demo-${s.id}.csv"` },
      });
    }
    return NextResponse.json(rows);
  }

  // The schedule follows the drawn or selected order; teams removed afterwards drop out of it.
  const ordered = order ? order.map((id) => teams.find((t) => t.id === id)).filter((t) => t !== undefined) : null;
  const plan = ordered ? schedule(ordered, { seconds: s.mode === "select" ? s.slotSeconds : undefined, start: s.windowStart }) : null;

  return NextResponse.json({
    session: { id: s.id, label: s.label, mode: s.mode, kinds: s.kinds, lockAt: s.lockAt, windowStart: s.windowStart, maxSlots: s.maxSlots, maxPerKind: s.maxPerKind ?? null, slotSeconds: s.slotSeconds },
    locked: locked(s, order),
    drawn: order !== null,
    drawnAt: orderedAt,
    secondsPerTeam: plan ? plan.seconds : s.mode === "select" ? s.slotSeconds : secondsPerTeam(teams.length),
    teams: teams.map(view),
    schedule: plan ? plan.slots.map((x) => ({ start: x.start, end: x.end, ...view(x.item) })) : null,
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const s = demoSession(body.session ?? request.nextUrl.searchParams.get("session"));
  if (!s) return NextResponse.json({ error: "Unknown session" }, { status: 404 });
  const prisma = getPrisma();
  const { teams, order } = await load(s);
  const isAdmin = await isAdminRequest(request);
  const username = await sessionLogin();

  if (body.action === "draw" || body.action === "select") {
    if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const owner = await prisma.user.findUnique({ where: { githubUsername: username ?? "MSACC" } });
    if (!owner) return NextResponse.json({ error: "The organiser has no portal account" }, { status: 400 });
    let ids: string[];
    if (body.action === "draw") {
      if (teams.length === 0) return NextResponse.json({ error: "No teams have signed up yet" }, { status: 400 });
      ids = shuffle(
        teams.map((t) => t.id),
        (max) => randomInt(max),
      );
    } else {
      const known = new Set(teams.map((t) => t.id));
      ids = (Array.isArray(body.ids) ? body.ids : []).filter((id: unknown): id is string => typeof id === "string" && known.has(id));
      ids = [...new Set(ids)];
      if (ids.length === 0) return NextResponse.json({ error: "Select at least one team" }, { status: 400 });
      if (ids.length > s.maxSlots) return NextResponse.json({ error: `At most ${s.maxSlots} teams` }, { status: 400 });
      // Two per track, unless the organisers say the split may be uneven (a track with one sign-up leaves a slot free).
      const over = body.uneven === true ? [] : overKind(ids.map((id) => teams.find((t) => t.id === id)?.entry.kind ?? ""), s.maxPerKind);
      if (over.length > 0) {
        const names = over.map((k) => trackOfKind(k)?.demo.label ?? k).join(", ");
        return NextResponse.json({ error: `At most ${s.maxPerKind} demos per track. Too many of: ${names}. Tick "uneven split" to allow it.` }, { status: 400 });
      }
    }
    await prisma.feedback.deleteMany({ where: { category: s.orderCategory } });
    await prisma.feedback.create({ data: { userId: owner.id, category: s.orderCategory, text: JSON.stringify({ order: ids }), status: "reviewed" } });
    return NextResponse.json({ ordered: true, teams: ids.length });
  }

  if (!username) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await prisma.user.findUnique({ where: { githubUsername: username } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (order !== null) return NextResponse.json({ error: "The demos have been chosen. Ask an organiser." }, { status: 400 });
  if (locked(s, order)) return NextResponse.json({ error: "Sign-up is closed" }, { status: 400 });

  const team = clean(body.team, 60);
  const title = clean(body.title, 100);
  const what = clean(body.what, 600);
  const why = clean(body.why, 400);
  const repo = normaliseRepo(body.repo);
  const link = normaliseLink(body.link);
  const kind: DemoKind | "" = isDemoKind(body.kind) ? body.kind : "";
  if (team.length < 2 || title.length < 3) return NextResponse.json({ error: "Enter your team or name and a title" }, { status: 400 });
  if (s.kinds && !kind) return NextResponse.json({ error: "Choose what you want to demo" }, { status: 400 });
  if (what.length < 20) return NextResponse.json({ error: "Describe in a sentence or two what you will show" }, { status: 400 });
  if (why.length < 10) return NextResponse.json({ error: "Tell us why others should hear it" }, { status: 400 });
  if (repo === null) return NextResponse.json({ error: "The repository must be in the SAAF-Project org, e.g. SAAF-Project/my-agent" }, { status: 400 });
  if (link === null) return NextResponse.json({ error: "The link must be a pull request or repo in the SAAF-Project org" }, { status: 400 });
  if (kind === "standard" && !link) return NextResponse.json({ error: "Link the pull request with your proposal" }, { status: 400 });
  if (kind === "checks" && !repo) return NextResponse.json({ error: "Name the repository that holds your llm_checks.yaml" }, { status: 400 });
  const taken = teams.find((t) => sameTeam(t.entry.team, team) && t.userId !== user.id);
  if (taken) {
    return NextResponse.json({ error: `${taken.entry.team} is already signed up by @${taken.user.githubUsername}. One sign-up per team.` }, { status: 409 });
  }
  const mine = teams.find((t) => t.userId === user.id);
  const text = JSON.stringify({ team, title, what, why, repo, kind, link });
  if (mine) await prisma.feedback.update({ where: { id: mine.id }, data: { text } });
  else await prisma.feedback.create({ data: { userId: user.id, category: s.category, text, status: "reviewed" } });
  return NextResponse.json({ team, title, what, why, repo, kind, link });
}

export async function DELETE(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const s = demoSession(params.get("session"));
  if (!s) return NextResponse.json({ error: "Unknown session" }, { status: 404 });
  const prisma = getPrisma();
  const id = params.get("id");
  const clearOrder = params.get("draw") !== null;

  if (clearOrder || id) {
    if (!(await isAdminRequest(request))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (clearOrder) {
      await prisma.feedback.deleteMany({ where: { category: s.orderCategory } });
      return NextResponse.json({ cleared: true });
    }
    const row = await prisma.feedback.findUnique({ where: { id: id! } });
    if (!row || row.category !== s.category) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await prisma.feedback.delete({ where: { id: id! } });
    return NextResponse.json({ removed: true });
  }

  // A member withdraws their own entry, only before the demos are chosen.
  const username = await sessionLogin();
  if (!username) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { order } = await load(s);
  if (order !== null) return NextResponse.json({ error: "The demos have been chosen. Ask an organiser." }, { status: 400 });
  const user = await prisma.user.findUnique({ where: { githubUsername: username } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
  await prisma.feedback.deleteMany({ where: { category: s.category, userId: user.id } });
  return NextResponse.json({ removed: true });
}
