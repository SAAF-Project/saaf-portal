import { describe, expect, it } from "vitest";
import { EMPTY_CHECKS, applyJury, clearJury, mergeChecks, toChecksDoc, type CheckIn, type ChecksDoc } from "./day-checks";
import { JURY_RESULT_EXAMPLE, juryPart, juryPartsText, juryPlaces, juryScoreText, parseJuryResult } from "./jury-result";

const CANDIDATES = ["example-agent", "second-agent", "third-agent", "another-agent", "Mixed-Case-Agent"];
const NOW = "2026-11-17T15:20:00Z";
const result = (results: unknown[], extra: Record<string, unknown> = {}) => ({ saaf_jury_result: 1, track: 3, results, ...extra });

describe("the jury's result for track 3", () => {
  it("reads the example the admin shows, as text and as an object", () => {
    const fromText = parseJuryResult(JURY_RESULT_EXAMPLE, CANDIDATES);
    expect(fromText.errors).toEqual([]);
    expect(fromText.ok).toBe(true);
    expect(fromText.max).toBe(16);
    expect(fromText.names).toHaveLength(2);
    expect(fromText.rows.map((r) => [r.repo, r.place, r.score])).toEqual([["example-agent", 1, 14], ["second-agent", 2, 12], ["third-agent", 3, 11], ["another-agent", null, 8]]);
    expect(fromText.rows[0].parts).toEqual({ criteria: 4, fit: 3, tracing: 4, evals: 3 });
    expect(parseJuryResult(JSON.parse(JURY_RESULT_EXAMPLE), CANDIDATES).rows).toEqual(fromText.rows);
    expect(juryPlaces(fromText)).toEqual({ "example-agent": 1, "second-agent": 2, "third-agent": 3 });
    const part = juryPart(fromText, NOW);
    expect(part.enteredAt).toBe(NOW);
    expect(part.results["another-agent"]).toEqual({ score: 8, parts: {}, reason: "" });
    expect(juryScoreText({ score: 14, max: part.max })).toBe("14/16");
    expect(juryScoreText({ score: null, max: 16 })).toBe("");
    expect(juryPartsText(part.results["example-agent"].parts)).toBe("criteria 4 · fit 3 · tracing 4 · evals 3");
  });

  it("matches a repo whatever the capitals and keeps the portal's spelling", () => {
    const r = parseJuryResult(result([{ repo: "mixed-case-agent", place: 1, score: 9.5 }]), CANDIDATES);
    expect(r.ok).toBe(true);
    expect(r.rows[0]).toMatchObject({ repo: "Mixed-Case-Agent", place: 1, score: 9.5 });
  });

  it("says in plain words what is wrong, row by row, and is then not ok", () => {
    expect(parseJuryResult("", CANDIDATES).errors[0]).toMatch(/Paste/);
    expect(parseJuryResult("{ not json", CANDIDATES).errors[0]).toMatch(/not valid JSON/);
    expect(parseJuryResult("[1]", CANDIDATES).errors[0]).toMatch(/one JSON object/);
    expect(parseJuryResult({ results: [{ repo: "example-agent" }] }, CANDIDATES).errors).toContain('"saaf_jury_result" must be 1.');
    expect(parseJuryResult(result([]), CANDIDATES).errors).toContain('"results" must be a list of 1 to 200 rows.');
    expect(parseJuryResult(result([{ repo: "example-agent" }], { track: 2 }), CANDIDATES).errors).toContain('"track" must be 3.');
    expect(parseJuryResult(result([{ repo: "example-agent" }], { max_score: 0 }), CANDIDATES).ok).toBe(false);
    expect(parseJuryResult(result([{ repo: "example-agent" }], { jury: ["a", "b", "c", "d", "e"] }), CANDIDATES).ok).toBe(false);

    const bad = parseJuryResult(
      result([
        { repo: "unknown-agent", place: 1 },
        { repo: "SAAF-Project/example-agent", place: 1 },
        { repo: "example-agent", place: 1, score: 17 },
        { repo: "second-agent", place: 1, score: 3.25 },
        { repo: "example-agent", place: 2 },
        { repo: "third-agent", place: 4, parts: { "bad name!": 1, fit: 101 }, reason: "x".repeat(201) },
        { place: 3 },
      ]),
      CANDIDATES,
    );
    expect(bad.ok).toBe(false);
    const all = bad.errors.join("\n");
    expect(all).toMatch(/Row 1 \(unknown-agent\): this repo is not in the portal's list/);
    expect(all).toMatch(/Row 2 .*repository name only/);
    expect(all).toMatch(/Row 3 \(example-agent\): "score" must be a number from 0 to 16/);
    expect(all).toMatch(/Row 4 \(second-agent\): place 1 is already given in row 3/);
    expect(all).toMatch(/Row 4 \(second-agent\): "score"/);
    expect(all).toMatch(/Row 5 \(example-agent\): this repo is also in row 3/);
    expect(all).toMatch(/Row 6 \(third-agent\): "place" must be 1, 2 or 3/);
    expect(all).toMatch(/part name "bad name!"/);
    expect(all).toMatch(/the part "fit" must be a number from 0 to 100/);
    expect(all).toMatch(/"reason" is 201 characters; at most 200/);
    expect(all).toMatch(/Row 7: "repo" is missing/);
  });

  it("takes a reason as plain text: control characters and line breaks become spaces", () => {
    const r = parseJuryResult(result([{ repo: "example-agent", reason: "Sharp\n checks.\u0007 <b>Bold</b>" }]), CANDIDATES);
    expect(r.rows[0].reason).toBe("Sharp checks. <b>Bold</b>"); // shown as text, never as markup
  });
});

describe("the track 3 document with a jury result", () => {
  const row = (repo: string): CheckIn => ({ repo, authors: ["person-1"], title: repo, llm: 3, code: 1, score: 0, place: null, feedback: null, flags: [] });
  const withCandidates = mergeChecks(EMPTY_CHECKS, [row("example-agent"), row("second-agent")], "2026-11-17T12:30:00Z");
  const parsed = parseJuryResult(result([{ repo: "example-agent", place: 1, score: 14, reason: "Caught a real defect." }, { repo: "second-agent", place: 2 }], { jury: ["Judge One, Example"] }), ["example-agent", "second-agent"]);
  const entered = applyJury(withCandidates, juryPlaces(parsed), juryPart(parsed, NOW), NOW);

  it("replaces every place and keeps the candidates", () => {
    const before: ChecksDoc = { ...withCandidates, places: { "second-agent": 1 } };
    const after = applyJury(before, juryPlaces(parsed), juryPart(parsed, NOW), NOW);
    expect(after.places).toEqual({ "example-agent": 1, "second-agent": 2 });
    expect(after.candidates).toEqual(withCandidates.candidates);
    expect(after.jury?.names).toEqual(["Judge One, Example"]);
    expect(after.jury?.results["second-agent"]).toBeUndefined(); // a place alone says nothing more
  });

  it("survives the facts script sending the candidates again", () => {
    const again = mergeChecks(entered, [row("example-agent"), row("second-agent"), row("third-agent")], "2026-11-17T15:25:00Z");
    expect(again.places).toEqual(entered.places);
    expect(again.jury).toEqual(entered.jury);
    expect(again.candidates.map((c) => c.repo)).toEqual(["example-agent", "second-agent", "third-agent"]);
  });

  it("is cleared in one go, and read back defensively", () => {
    expect(clearJury(entered, NOW)).toEqual({ candidates: entered.candidates, places: {}, updatedAt: NOW });
    expect(toChecksDoc(JSON.parse(JSON.stringify(entered))).jury).toEqual(entered.jury);
    expect(toChecksDoc({ ...entered, jury: "nonsense" }).jury).toBeUndefined();
    const odd = toChecksDoc({ ...entered, jury: { results: { "example-agent": { score: "high", parts: { fit: "x", evals: 3 }, reason: 7 } } } });
    expect(odd.jury).toEqual({ names: [], max: 16, results: { "example-agent": { score: null, parts: { evals: 3 }, reason: "" } }, enteredAt: null });
  });
});
