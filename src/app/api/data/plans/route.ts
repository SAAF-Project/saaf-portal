import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { loadPlans } from "@/lib/progress-data";

// plans.json, for logged-in users only (#8): live from SAAF-Project main, the bundled copy without personal fields otherwise.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const loaded = await loadPlans();
  return NextResponse.json(loaded.data, { headers: { "X-Data-Source": loaded.source, "Cache-Control": "private, no-store" } });
}
