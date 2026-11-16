import type { JuryPart, JuryScore } from "./day-checks";

// The result of track 3 (LLM checks) as the jury hands it to the organisers: one JSON object in a fixed shape, so it
// can be pasted into the admin and shows on the board and in the winners view without retyping. The jury's own review
// tool writes it. This file is pure: it reads the object, says in plain words what is wrong with it, and turns a
// correct one into what the portal stores (src/lib/day-checks.ts).

export const JURY_RESULT_VERSION = 1;
/** The highest score when the result does not name one: four parts of 0 to 4. */
export const JURY_MAX_SCORE = 16;
export const JURY_REASON_MAX = 200;

/** The shape, with made-up repos. Shown in the admin to copy and send to the jury. */
export const JURY_RESULT_EXAMPLE = `{
  "saaf_jury_result": 1,
  "track": 3,
  "session": "2026-11-17",
  "jury": ["Name, Organisation", "Name, Organisation"],
  "max_score": 16,
  "results": [
    { "repo": "example-agent", "place": 1, "score": 14, "parts": { "criteria": 4, "fit": 3, "tracing": 4, "evals": 3 }, "reason": "One sentence the room hears: why this one won." },
    { "repo": "second-agent", "place": 2, "score": 12, "parts": { "criteria": 3, "fit": 3, "tracing": 3, "evals": 3 }, "reason": "One sentence." },
    { "repo": "third-agent", "place": 3, "score": 11, "reason": "One sentence." },
    { "repo": "another-agent", "score": 8 }
  ]
}`;

/** The rules of the shape, in the words the jury needs. */
export const JURY_RESULT_RULES: string[] = [
  '"repo" is the repository name in SAAF-Project, without the organisation or a URL. It must be a repo the portal lists for track 3.',
  '"place" is 1, 2 or 3, each given once. Leave it out for a repo without a place.',
  '"score" is a number from 0 to "max_score" (16 when left out), with at most one decimal. Optional.',
  '"parts" names up to six part scores, for example criteria, fit, tracing and evals. Optional.',
  `"reason" is one plain sentence of at most ${JURY_REASON_MAX} characters. The room reads it under the winner. Optional.`,
  '"jury" names at most four people. One wrong row and nothing is saved: the admin says which row and why.',
];

export interface JuryRow extends JuryScore {
  repo: string;
  place: 1 | 2 | 3 | null;
}

export interface JuryResult {
  ok: boolean;
  errors: string[];
  names: string[];
  max: number;
  rows: JuryRow[];
}

const clean = (v: string): string => v.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
const oneDecimal = (n: number): boolean => Math.abs(n * 10 - Math.round(n * 10)) < 1e-9;
const PART = /^[A-Za-z0-9][A-Za-z0-9 -]{0,19}$/;

/**
 * Read a result: JSON text or the object itself. `candidates` are the repos the portal knows for track 3. Every
 * mistake comes back in `errors`; with one or more, nothing may be saved.
 */
export function parseJuryResult(input: unknown, candidates: string[]): JuryResult {
  const fail = (error: string): JuryResult => ({ ok: false, errors: [error], names: [], max: JURY_MAX_SCORE, rows: [] });
  let data: unknown = input;
  if (typeof input === "string") {
    if (!input.trim()) return fail("Paste the jury's result first.");
    try {
      data = JSON.parse(input);
    } catch {
      return fail("This is not valid JSON. Paste the whole result, from the first { to the last }.");
    }
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) return fail("The result must be one JSON object.");
  const d = data as Record<string, unknown>;
  const errors: string[] = [];
  if (d.saaf_jury_result !== JURY_RESULT_VERSION) errors.push(`"saaf_jury_result" must be ${JURY_RESULT_VERSION}.`);
  if (d.track !== undefined && d.track !== 3) errors.push('"track" must be 3.');
  let max = JURY_MAX_SCORE;
  if (d.max_score !== undefined) {
    if (typeof d.max_score === "number" && Number.isInteger(d.max_score) && d.max_score >= 1 && d.max_score <= 100) max = d.max_score;
    else errors.push('"max_score" must be a whole number from 1 to 100.');
  }
  const names: string[] = [];
  if (d.jury !== undefined) {
    const list = Array.isArray(d.jury) ? d.jury : null;
    if (!list || list.length > 4 || list.some((n) => typeof n !== "string" || clean(n).length === 0 || clean(n).length > 60)) {
      errors.push('"jury" must be a list of at most four names of at most 60 characters each.');
    } else names.push(...list.map((n) => clean(n as string)));
  }
  const rows: JuryRow[] = [];
  if (!Array.isArray(d.results) || d.results.length < 1 || d.results.length > 200) {
    errors.push('"results" must be a list of 1 to 200 rows.');
    return { ok: false, errors, names, max, rows };
  }
  const known = new Map(candidates.map((c) => [c.toLowerCase(), c]));
  const rowOfRepo = new Map<string, number>();
  const rowOfPlace = new Map<number, number>();
  d.results.forEach((raw, i) => {
    const n = i + 1;
    const r = (raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {}) as Record<string, unknown>;
    const given = typeof r.repo === "string" ? clean(r.repo) : "";
    const label = given ? `Row ${n} (${given.slice(0, 60)})` : `Row ${n}`;
    if (!given) return void errors.push(`${label}: "repo" is missing.`);
    if (/[/:]/.test(given)) return void errors.push(`${label}: give the repository name only, without the organisation or a URL.`);
    const repo = known.get(given.toLowerCase());
    if (!repo) return void errors.push(`${label}: this repo is not in the portal's list for track 3.`);
    if (rowOfRepo.has(repo)) return void errors.push(`${label}: this repo is also in row ${rowOfRepo.get(repo)}.`);
    rowOfRepo.set(repo, n);

    let place: JuryRow["place"] = null;
    if (r.place !== undefined && r.place !== null) {
      if (r.place !== 1 && r.place !== 2 && r.place !== 3) errors.push(`${label}: "place" must be 1, 2 or 3, or left out.`);
      else if (rowOfPlace.has(r.place)) errors.push(`${label}: place ${r.place} is already given in row ${rowOfPlace.get(r.place)}.`);
      else {
        rowOfPlace.set(r.place, n);
        place = r.place;
      }
    }
    let score: number | null = null;
    if (r.score !== undefined && r.score !== null) {
      if (typeof r.score === "number" && Number.isFinite(r.score) && r.score >= 0 && r.score <= max && oneDecimal(r.score)) score = Math.round(r.score * 10) / 10;
      else errors.push(`${label}: "score" must be a number from 0 to ${max}, with at most one decimal.`);
    }
    const parts: Record<string, number> = {};
    if (r.parts !== undefined && r.parts !== null) {
      const entries = typeof r.parts === "object" && !Array.isArray(r.parts) ? Object.entries(r.parts as Record<string, unknown>) : null;
      if (!entries || entries.length > 6) errors.push(`${label}: "parts" must hold at most six named scores.`);
      else {
        for (const [name, value] of entries) {
          if (!PART.test(name)) errors.push(`${label}: the part name "${name.slice(0, 30)}" must be 1 to 20 letters, digits, spaces or hyphens.`);
          else if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 100) errors.push(`${label}: the part "${name}" must be a number from 0 to 100.`);
          else parts[name] = value;
        }
      }
    }
    let reason = "";
    if (r.reason !== undefined && r.reason !== null) {
      if (typeof r.reason !== "string") errors.push(`${label}: "reason" must be text.`);
      else {
        reason = clean(r.reason);
        if (reason.length > JURY_REASON_MAX) errors.push(`${label}: "reason" is ${reason.length} characters; at most ${JURY_REASON_MAX}.`);
      }
    }
    rows.push({ repo, place, score, parts, reason });
  });
  rows.sort((a, b) => (a.place ?? 9) - (b.place ?? 9) || (b.score ?? -1) - (a.score ?? -1) || a.repo.localeCompare(b.repo));
  return { ok: errors.length === 0, errors, names, max, rows };
}

/** The places of a correct result: repo name to 1, 2 or 3. */
export function juryPlaces(result: JuryResult): Record<string, number> {
  return Object.fromEntries(result.rows.filter((r) => r.place !== null).map((r) => [r.repo, r.place as number]));
}

/** What the portal stores of a correct result: per repo the score, its parts and the reason. */
export function juryPart(result: JuryResult, now: string): JuryPart {
  const results: Record<string, JuryScore> = {};
  for (const r of result.rows) {
    if (r.score !== null || r.reason || Object.keys(r.parts).length > 0) results[r.repo] = { score: r.score, parts: r.parts, reason: r.reason };
  }
  return { names: result.names, max: result.max, results, enteredAt: now };
}

/** "14/16", or nothing when the jury gave no score. */
export const juryScoreText = (j: { score: number | null; max: number }): string => (j.score === null ? "" : `${j.score}/${j.max}`);

/** "criteria 4 · fit 3", in the order the jury gave. */
export const juryPartsText = (parts: Record<string, number>): string =>
  Object.entries(parts)
    .map(([name, value]) => `${name} ${value}`)
    .join(" · ");
