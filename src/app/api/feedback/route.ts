import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";

const VALID_CATEGORIES = ["portal", "saaf-project", "bug", "feature", "general"];

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const username = (session?.user as { githubUsername?: string })?.githubUsername;
  if (!username) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await getPrisma().user.findUnique({ where: { githubUsername: username } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const body = await request.json();
  const text = String(body.text || "").trim();
  if (text.length < 10) {
    return NextResponse.json({ error: "Feedback must be at least 10 characters" }, { status: 400 });
  }

  const category = body.category && VALID_CATEGORIES.includes(body.category) ? body.category : null;

  const feedback = await getPrisma().feedback.create({
    data: { userId: user.id, category, text: text.slice(0, 5000) },
  });

  return NextResponse.json({ id: feedback.id });
}
