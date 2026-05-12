import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";

const ADMIN_USERNAME = "MSACC";

export async function GET() {
  const session = await getServerSession(authOptions);
  const username = (session?.user as { githubUsername?: string })
    ?.githubUsername;

  if (username !== ADMIN_USERNAME) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const requests = await getPrisma().signupRequest.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });

  return NextResponse.json(requests);
}
