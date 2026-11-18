import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { planPath } from "@/lib/plan-path";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Only a plain session and slug become part of the path that is fetched with the portal's token.
  const path = planPath(request.nextUrl.searchParams.get("session"), request.nextUrl.searchParams.get("slug"));
  if (!path) {
    return NextResponse.json({ error: "session and slug must be the plain names of a plan" }, { status: 400 });
  }

  const res = await fetch(
    `https://api.github.com/repos/SAAF-Project/SAAF-Project/contents/${path}`,
    {
      headers: {
        Authorization: `Bearer ${process.env.GITHUB_PAT}`,
        Accept: "application/vnd.github.raw+json",
      },
      next: { revalidate: 300 },
    }
  );

  if (!res.ok) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const content = await res.text();
  return new NextResponse(content, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
