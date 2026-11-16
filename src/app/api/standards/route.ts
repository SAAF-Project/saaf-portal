import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sharedBoard } from "@/lib/shared-loaders";

// The instance whose turn it is to refresh the shared snapshot asks GitHub (the very first time about sixty calls,
// six at a time); give it room. Every other call reads one database row.
export const maxDuration = 30;

// Data for the standards board (/standards): the nine standards per repo, read from GitHub with the server's token.
// Signed-in members only: the answer names private repos.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return NextResponse.json(await sharedBoard());
}
