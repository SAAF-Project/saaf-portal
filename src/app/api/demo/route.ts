import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";

// Demo slots for the 10 November session, stored as Feedback rows with this
// category (text = JSON), so no database migration is needed.
const DEMO_CATEGORY = "demo-2026-11";
const DEMO_SLOTS = ["16:30", "16:35", "16:40", "16:45", "16:50", "16:55"];
// Sign-up closes when demos start: 16:30 Amsterdam time on 10 November 2026.
const LOCK_AT = new Date("2026-11-10T15:30:00Z");
const ADMIN_USERNAME = "MSACC";

interface DemoEntry {
  slot: string;
  team: string;
  title: string;
}

async function currentUsername(): Promise<string | undefined> {
  const session = await getServerSession(authOptions);
  return (session?.user as { githubUsername?: string })?.githubUsername;
}

function parse(text: string): DemoEntry | null {
  try {
    const v = JSON.parse(text);
    if (typeof v.slot === "string" && typeof v.team === "string" && typeof v.title === "string") return v;
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

async function listEntries() {
  const rows = await getPrisma().feedback.findMany({
    where: { category: DEMO_CATEGORY },
    include: { user: { select: { githubUsername: true, name: true, organisation: true } } },
    orderBy: { createdAt: "asc" },
  });
  return rows
    .map((r) => ({ id: r.id, userId: r.userId, entry: parse(r.text), user: r.user, createdAt: r.createdAt }))
    .filter((r) => r.entry !== null) as {
    id: string;
    userId: string;
    entry: DemoEntry;
    user: { githubUsername: string; name: string | null; organisation: string | null };
    createdAt: Date;
  }[];
}

export async function GET() {
  const username = await currentUsername();
  if (!username) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const entries = await listEntries();
  const isAdmin = username === ADMIN_USERNAME;

  return NextResponse.json({
    locked: Date.now() >= LOCK_AT.getTime(),
    slots: DEMO_SLOTS.map((slot) => {
      const e = entries.find((x) => x.entry.slot === slot);
      if (!e) return { slot, taken: false };
      return {
        slot,
        taken: true,
        team: e.entry.team,
        title: e.entry.title,
        mine: e.user.githubUsername === username,
        ...(isAdmin ? { id: e.id, githubUsername: e.user.githubUsername, name: e.user.name, organisation: e.user.organisation } : {}),
      };
    }),
  });
}

export async function POST(request: NextRequest) {
  const username = await currentUsername();
  if (!username) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (Date.now() >= LOCK_AT.getTime()) {
    return NextResponse.json({ error: "Sign-up is closed" }, { status: 400 });
  }
  const prisma = getPrisma();
  const user = await prisma.user.findUnique({ where: { githubUsername: username } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const slot = String(body.slot || "");
  const team = clean(body.team, 60);
  const title = clean(body.title, 100);
  if (!DEMO_SLOTS.includes(slot)) return NextResponse.json({ error: "Unknown slot" }, { status: 400 });
  if (team.length < 2 || title.length < 3) {
    return NextResponse.json({ error: "Enter a team name and the name of your guard" }, { status: 400 });
  }

  const entries = await listEntries();
  if (entries.some((e) => e.entry.slot === slot && e.userId !== user.id)) {
    return NextResponse.json({ error: "That slot was just taken. Pick another one." }, { status: 409 });
  }
  const mine = entries.find((e) => e.userId === user.id);
  const text = JSON.stringify({ slot, team, title });
  if (mine) {
    await prisma.feedback.update({ where: { id: mine.id }, data: { text } });
  } else {
    await prisma.feedback.create({ data: { userId: user.id, category: DEMO_CATEGORY, text, status: "reviewed" } });
  }
  return NextResponse.json({ slot, team, title });
}

export async function DELETE(request: NextRequest) {
  const username = await currentUsername();
  if (!username) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const prisma = getPrisma();
  const id = request.nextUrl.searchParams.get("id");

  if (id) {
    // Admin releases any slot.
    if (username !== ADMIN_USERNAME) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const row = await prisma.feedback.findUnique({ where: { id } });
    if (!row || row.category !== DEMO_CATEGORY) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await prisma.feedback.delete({ where: { id } });
    return NextResponse.json({ released: true });
  }

  // A member releases their own slot.
  const user = await prisma.user.findUnique({ where: { githubUsername: username } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
  await prisma.feedback.deleteMany({ where: { category: DEMO_CATEGORY, userId: user.id } });
  return NextResponse.json({ released: true });
}
