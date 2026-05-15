import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";

const ADMIN_USERNAME = "MSACC";

async function checkAdmin() {
  const session = await getServerSession(authOptions);
  const username = (session?.user as { githubUsername?: string })?.githubUsername;
  return username === ADMIN_USERNAME;
}

export async function GET() {
  if (!(await checkAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const items = await getPrisma().feedback.findMany({
    include: {
      user: { select: { name: true, githubUsername: true, avatarUrl: true, organisation: true } },
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });

  return NextResponse.json(items);
}

export async function PATCH(request: NextRequest) {
  if (!(await checkAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  if (!body.id || !["new", "reviewed", "resolved"].includes(body.status)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  await getPrisma().feedback.update({
    where: { id: body.id },
    data: { status: body.status },
  });

  return NextResponse.json({ success: true });
}
