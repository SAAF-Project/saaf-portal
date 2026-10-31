import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { loadProgress, loadSubmitters } from "@/lib/progress-data";
import { loadRepoSignals } from "@/lib/repo-signals";
import { applyRepoSignals } from "@/components/temple/liveAlerts";
import type { ProgressData } from "@/components/temple/types";

// Data for the /progress visual: live from SAAF-Project main when possible, the bundled copy otherwise.
// The alerts that need the state of a plan's repo (no AUDIT-CRITERIA.md, no tests, quiet, archived) are added here.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [progress, submitters] = await Promise.all([loadProgress(), loadSubmitters()]);
  const plans = (progress.data as ProgressData).plans;
  const signals = await loadRepoSignals(plans);
  return NextResponse.json({
    progress: applyRepoSignals(progress.data as ProgressData, signals),
    submitters: submitters.data,
    source: progress.source === "live" ? "live" : "bundled",
    repo_checks: signals ? signals.checked_at : null,
  });
}
