import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const session_ = request.nextUrl.searchParams.get("session");
  const slug = request.nextUrl.searchParams.get("slug");

  if (!session_ || !slug) {
    return NextResponse.json({ error: "session and slug required" }, { status: 400 });
  }

  const path = `plans/${session_}/${slug}.md`;

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
