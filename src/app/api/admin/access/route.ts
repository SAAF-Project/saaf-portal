import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin";
import { listRequests, setStatus } from "@/lib/access";
import { getPrisma } from "@/lib/prisma";

// Access requests for the organisers (approve, refuse) and for the Claude Code session on Mathijs's Mac, which grants
// write access with gh for every approved request and then marks it granted. MSACC or the portal's admin token.
export async function GET(request: NextRequest) {
  if (!(await isAdminRequest(request))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const status = request.nextUrl.searchParams.get("status");
  const all = await listRequests(getPrisma());
  return NextResponse.json({ requests: status ? all.filter((r) => r.status === status) : all });
}

export async function POST(request: NextRequest) {
  if (!(await isAdminRequest(request))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = (await request.json().catch(() => null)) as { id?: unknown; action?: unknown } | null;
  if (!body || typeof body.id !== "string" || typeof body.action !== "string") return NextResponse.json({ error: "Bad request" }, { status: 400 });
  const prisma = getPrisma();
  const done = await setStatus(prisma, body.id, body.action);
  if (!done) return NextResponse.json({ error: "Not possible from this status" }, { status: 409 });
  return NextResponse.json({ request: done, requests: await listRequests(prisma) });
}
