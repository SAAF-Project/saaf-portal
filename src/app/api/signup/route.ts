import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const rawUsername = body.githubUsername
    ? String(body.githubUsername).replace("@", "").trim()
    : "";
  const rawEmail = body.email ? String(body.email).trim() : "";

  if (!rawUsername && !rawEmail) {
    return NextResponse.json(
      { error: "Please provide a GitHub username or email address" },
      { status: 400 }
    );
  }

  const identifier = rawUsername || rawEmail;

  const existing = await getPrisma().signupRequest.findFirst({
    where: {
      OR: [
        ...(rawUsername ? [{ githubUsername: rawUsername, status: "pending" }] : []),
        ...(rawEmail ? [{ email: rawEmail, status: "pending" }] : []),
      ],
    },
  });

  if (existing) {
    return NextResponse.json({ message: "Request already pending" });
  }

  await getPrisma().signupRequest.create({
    data: {
      githubUsername: rawUsername || identifier,
      email: rawEmail || null,
    },
  });

  return NextResponse.json({ message: "Request submitted" });
}
