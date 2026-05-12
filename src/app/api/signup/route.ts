import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { githubUsername, email } = body;

  if (!githubUsername || typeof githubUsername !== "string") {
    return NextResponse.json(
      { error: "GitHub username is required" },
      { status: 400 }
    );
  }

  const username = githubUsername.replace("@", "").trim();
  if (!username) {
    return NextResponse.json(
      { error: "Invalid username" },
      { status: 400 }
    );
  }

  const existing = await getPrisma().signupRequest.findFirst({
    where: { githubUsername: username, status: "pending" },
  });

  if (existing) {
    return NextResponse.json({ message: "Request already pending" });
  }

  await getPrisma().signupRequest.create({
    data: {
      githubUsername: username,
      email: email || null,
    },
  });

  return NextResponse.json({ message: "Request submitted" });
}
