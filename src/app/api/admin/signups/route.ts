import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin";
import { getPrisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const requests = await getPrisma().signupRequest.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });

  return NextResponse.json(requests);
}
