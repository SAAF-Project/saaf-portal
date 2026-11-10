import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";

// Pizza at 17:30 on 10 November: yes or no per member, stored as Feedback rows (text = "yes" | "no"),
// so no database migration is needed. Closes at 16:00 Amsterdam time so the order can go out.
const PIZZA_CATEGORY = "pizza-2026-11";
const LOCK_AT = new Date("2026-11-10T15:00:00Z");
const ADMIN_USERNAME = "MSACC";

async function currentUsername(): Promise<string | undefined> {
  const session = await getServerSession(authOptions);
  return (session?.user as { githubUsername?: string })?.githubUsername;
}

export async function GET() {
  const username = await currentUsername();
  if (!username) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rows = await getPrisma().feedback.findMany({
    where: { category: PIZZA_CATEGORY },
    include: { user: { select: { githubUsername: true, name: true, organisation: true } } },
    orderBy: { createdAt: "asc" },
  });
  const valid = rows.filter((r) => r.text === "yes" || r.text === "no");
  const mine = valid.find((r) => r.user.githubUsername === username);
  return NextResponse.json({
    choice: mine ? mine.text : null,
    yes: valid.filter((r) => r.text === "yes").length,
    no: valid.filter((r) => r.text === "no").length,
    locked: Date.now() >= LOCK_AT.getTime(),
    ...(username === ADMIN_USERNAME
      ? {
          people: valid.map((r) => ({
            choice: r.text,
            githubUsername: r.user.githubUsername,
            name: r.user.name,
            organisation: r.user.organisation,
          })),
        }
      : {}),
  });
}

export async function POST(request: NextRequest) {
  const username = await currentUsername();
  if (!username) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (Date.now() >= LOCK_AT.getTime()) return NextResponse.json({ error: "The pizza order has gone out" }, { status: 400 });
  const body = await request.json().catch(() => ({}));
  const choice = body.choice === "yes" ? "yes" : body.choice === "no" ? "no" : null;
  if (!choice) return NextResponse.json({ error: "Choose yes or no" }, { status: 400 });

  const prisma = getPrisma();
  const user = await prisma.user.findUnique({ where: { githubUsername: username } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
  const existing = await prisma.feedback.findFirst({ where: { category: PIZZA_CATEGORY, userId: user.id } });
  if (existing) {
    await prisma.feedback.update({ where: { id: existing.id }, data: { text: choice } });
  } else {
    await prisma.feedback.create({ data: { userId: user.id, category: PIZZA_CATEGORY, text: choice, status: "reviewed" } });
  }
  return NextResponse.json({ choice });
}
