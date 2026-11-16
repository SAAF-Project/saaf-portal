import { describe, expect, it } from "vitest";
import type { ChecksDoc } from "../../lib/day-checks";
import { parseJuryResult } from "../../lib/jury-result";
import { resultFromForm } from "./Track3Tab";

const candidate = (repo: string) => ({ repo, authors: ["person-1"], title: repo, llm: 3, code: 1, score: 0, feedback: null, flags: [], firstAt: "2026-11-17T12:00:00Z" });
const doc: ChecksDoc = {
  candidates: [candidate("example-agent"), candidate("second-agent"), candidate("third-agent")],
  places: {},
  updatedAt: null,
  jury: { names: [], max: 16, results: { "example-agent": { score: 14, parts: { criteria: 4 }, reason: "" } }, enteredAt: null },
};

describe("the track 3 result entered by hand", () => {
  it("becomes a result in the jury's shape, with only the repos something was said about", () => {
    const hand = { "example-agent": { place: "1", score: "14,5", reason: "Caught a real defect." }, "second-agent": { place: "", score: "", reason: "" }, "third-agent": { place: "2", score: "", reason: "" } };
    const built = resultFromForm(doc, hand, "Judge One, Example\n\nJudge Two, Example", "16");
    expect(built).toMatchObject({ saaf_jury_result: 1, track: 3, jury: ["Judge One, Example", "Judge Two, Example"], max_score: 16 });
    expect(built.results).toEqual([
      { repo: "example-agent", place: 1, score: 14.5, reason: "Caught a real defect.", parts: { criteria: 4 } }, // the parts the jury pasted earlier stay
      { repo: "third-agent", place: 2 },
    ]);
    expect(parseJuryResult(built, doc.candidates.map((c) => c.repo)).ok).toBe(true);
  });

  it("is refused by the same check as a pasted result when it is wrong", () => {
    const twice = { "example-agent": { place: "1", score: "", reason: "" }, "second-agent": { place: "1", score: "99", reason: "" } };
    const errors = parseJuryResult(resultFromForm(doc, twice, "", ""), doc.candidates.map((c) => c.repo)).errors.join(" ");
    expect(errors).toMatch(/place 1 is already given/);
    expect(errors).toMatch(/"score" must be a number from 0 to 16/);
  });
});
