import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";

// One quiz per session day. Guesses are stored as Feedback rows with this
// category, so no database migration is needed.
const QUIZ_CATEGORY = "quiz-2026-11";
// Guesses lock at 17:00 Amsterdam time on 10 November 2026.
const LOCK_AT = new Date("2026-11-10T16:00:00Z");
const ADMIN_USERNAME = "MSACC";
const MAX_GUESS = 100000;

async function currentUsername(): Promise<string | undefined> {
  const session = await getServerSession(authOptions);
  return (session?.user as { githubUsername?: string })?.githubUsername;
}

function csvCell(value: string): string {
  // Neutralise spreadsheet formulas and quote every cell.
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

export async function GET(request: NextRequest) {
  const username = await currentUsername();
  if (!username) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const prisma = getPrisma();

  if (request.nextUrl.searchParams.get("format") === "json") {
    if (username !== ADMIN_USERNAME) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const rows = await prisma.feedback.findMany({
      where: { category: QUIZ_CATEGORY },
      include: { user: { select: { githubUsername: true, name: true, organisation: true } } },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json(
      rows.map((r) => ({
        githubUsername: r.user.githubUsername,
        name: r.user.name,
        organisation: r.user.organisation,
        guess: Number(r.text),
        createdAt: r.createdAt,
      })),
    );
  }

  if (request.nextUrl.searchParams.get("format") === "csv") {
    if (username !== ADMIN_USERNAME) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const rows = await prisma.feedback.findMany({
      where: { category: QUIZ_CATEGORY },
      include: { user: { select: { githubUsername: true, name: true } } },
      orderBy: { createdAt: "asc" },
    });
    const lines = ["name,guess,display_name"].concat(
      rows.map((r) => [r.user.githubUsername, r.text, r.user.name ?? ""].map(csvCell).join(",")),
    );
    return new NextResponse(lines.join("\n") + "\n", {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${QUIZ_CATEGORY}-guesses.csv"`,
      },
    });
  }

  const user = await prisma.user.findUnique({ where: { githubUsername: username } });
  const [count, mine] = await Promise.all([
    prisma.feedback.count({ where: { category: QUIZ_CATEGORY } }),
    user
      ? prisma.feedback.findFirst({ where: { category: QUIZ_CATEGORY, userId: user.id } })
      : Promise.resolve(null),
  ]);

  return NextResponse.json({
    count,
    guess: mine ? Number(mine.text) : null,
    locked: Date.now() >= LOCK_AT.getTime(),
    lockAt: LOCK_AT.toISOString(),
  });
}

export async function POST(request: NextRequest) {
  const username = await currentUsername();
  if (!username) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (Date.now() >= LOCK_AT.getTime()) {
    return NextResponse.json({ error: "The quiz is closed" }, { status: 400 });
  }

  const prisma = getPrisma();
  const user = await prisma.user.findUnique({ where: { githubUsername: username } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const guess = Number(body.guess);
  if (!Number.isInteger(guess) || guess < 0 || guess > MAX_GUESS) {
    return NextResponse.json({ error: `Enter a whole number from 0 to ${MAX_GUESS}` }, { status: 400 });
  }

  // One guess per person; a new guess replaces the old one until the lock.
  const existing = await prisma.feedback.findFirst({
    where: { category: QUIZ_CATEGORY, userId: user.id },
  });
  if (existing) {
    await prisma.feedback.update({ where: { id: existing.id }, data: { text: String(guess) } });
  } else {
    await prisma.feedback.create({
      data: { userId: user.id, category: QUIZ_CATEGORY, text: String(guess), status: "reviewed" },
    });
  }

  return NextResponse.json({ guess });
}
