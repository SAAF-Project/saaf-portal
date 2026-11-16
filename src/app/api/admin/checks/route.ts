import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin";
import { applyJury, clearJury, isPlace, mergeChecks, setPlace, validateChecks } from "@/lib/day-checks";
import { loadChecks, saveChecks } from "@/lib/day-checks-db";
import { juryPart, juryPlaces, parseJuryResult } from "@/lib/jury-result";
import { forgetLeaderboard } from "@/lib/leaderboard-load";

// Track 3 of the hardening day, LLM checks. The facts script on the organisers' laptop sends the repos that have
// checks ({ checks: [...] }); the organisers enter the places the jury gave ({ place: { repo, place } }, place 1 to 3
// or null to clear), or the jury's whole result in the shape of src/lib/jury-result.ts ({ result: {...} }, which
// replaces all places, scores and reasons; { result: null } clears them). MSACC or the portal's admin token.
export async function GET(request: NextRequest) {
  if (!(await isAdminRequest(request))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json({ checks: await loadChecks() });
}

export async function POST(request: NextRequest) {
  if (!(await isAdminRequest(request))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = (await request.json().catch(() => null)) as { checks?: unknown; place?: { repo?: unknown; place?: unknown }; result?: unknown } | null;
  if (!body || (body.checks === undefined && body.place === undefined && body.result === undefined)) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  const now = new Date().toISOString();
  let doc = await loadChecks();
  let saved = 0;
  let refused: string[] = [];
  if (body.checks !== undefined) {
    const { ok, errors } = validateChecks(body.checks);
    doc = mergeChecks(doc, ok, now);
    saved = ok.length;
    refused = errors;
  }
  if (body.place !== undefined) {
    const { repo, place } = body.place;
    if (typeof repo !== "string" || !doc.candidates.some((c) => c.repo === repo) || !(place === null || isPlace(place))) {
      return NextResponse.json({ error: "Unknown repo or bad place" }, { status: 400 });
    }
    doc = setPlace(doc, repo, place, now);
  }
  if (body.result !== undefined) {
    if (body.result === null) doc = clearJury(doc, now);
    else {
      const result = parseJuryResult(body.result, doc.candidates.map((c) => c.repo));
      if (!result.ok) return NextResponse.json({ error: "The result was not saved", errors: result.errors }, { status: 400 });
      doc = applyJury(doc, juryPlaces(result), juryPart(result, now), now);
    }
  }
  await saveChecks(doc);
  forgetLeaderboard();
  return NextResponse.json({ saved, refused, checks: doc });
}
