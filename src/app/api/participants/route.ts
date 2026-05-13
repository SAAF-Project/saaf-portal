import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const users = await getPrisma().user.findMany({
    select: {
      id: true,
      githubUsername: true,
      name: true,
      avatarUrl: true,
      organisation: true,
      companyLogoUrl: true,
      role: true,
      preferredTrack: true,
      skillPrompts: true,
      skillTools: true,
      skillRegulatory: true,
      skillOutputs: true,
      githubId: true,
    },
    orderBy: [{ name: "asc" }],
  });

  return NextResponse.json(users);
}
