import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { readSignup } from "@/lib/signup";

export async function POST(request: NextRequest) {
  // The form is public. Only a real GitHub username or an email address is stored.
  const input = readSignup(await request.json().catch(() => null));
  if (!input.ok) {
    return NextResponse.json({ error: input.error }, { status: 400 });
  }
  const { githubUsername: rawUsername, email: rawEmail } = input;

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
    // The same answer as for a new request, so this route does not tell who already asked for access.
    return NextResponse.json({ message: "Request submitted" });
  }

  await getPrisma().signupRequest.create({
    data: {
      githubUsername: rawUsername || identifier,
      email: rawEmail || null,
    },
  });

  return NextResponse.json({ message: "Request submitted" });
}
