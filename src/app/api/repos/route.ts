import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { fetchUserOrgRepos } from "@/lib/github";

export async function GET() {
  const session = await getServerSession(authOptions);
  const username = (session?.user as { githubUsername?: string })
    ?.githubUsername;

  if (!username) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const repos = await fetchUserOrgRepos(username);
    return NextResponse.json(repos);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
