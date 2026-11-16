import { NextRequest, NextResponse } from "next/server";
import { sessionLogin } from "@/lib/admin";
import { ACCESS_CATEGORY, listRequests, validateRequest } from "@/lib/access";
import { getPrisma } from "@/lib/prisma";
import { sharedBoard } from "@/lib/shared-loaders";

// A member asks for write access to a repo that is not theirs (to revive it, merge it or help). Mathijs approves in
// the admin; then it is granted from his Mac. The member sees the status here.
export async function GET() {
  const login = await sessionLogin();
  if (!login) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ requests: await listRequests(getPrisma(), login) });
}

export async function POST(request: NextRequest) {
  const login = await sessionLogin();
  if (!login) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const prisma = getPrisma();
  const user = await prisma.user.findUnique({ where: { githubUsername: login } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
  const board = await sharedBoard();
  const checked = validateRequest(await request.json().catch(() => null), (board.repos ?? []).map((r) => r.name));
  if ("error" in checked) return NextResponse.json({ error: checked.error }, { status: 400 });
  const open = (await listRequests(prisma, login)).find((r) => r.repo === checked.ok.repo && (r.status === "waiting" || r.status === "approved"));
  if (open) return NextResponse.json({ error: "You already asked for this repo" }, { status: 409 });
  await prisma.feedback.create({ data: { userId: user.id, category: ACCESS_CATEGORY, text: JSON.stringify(checked.ok), status: "new" } });
  return NextResponse.json({ requests: await listRequests(prisma, login) });
}

export async function DELETE(request: NextRequest) {
  const login = await sessionLogin();
  if (!login) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = request.nextUrl.searchParams.get("id") ?? "";
  const prisma = getPrisma();
  const mine = (await listRequests(prisma, login)).find((r) => r.id === id && r.status === "waiting");
  if (!mine) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.feedback.delete({ where: { id } });
  return NextResponse.json({ requests: await listRequests(prisma, login) });
}
