// Track 3 of the hardening day: the repos that have LLM checks (candidates, sent in by the facts script of the review
// on the organisers' laptop) and the places the jury gave them (Orq.ai and an experienced auditor). Kept as one JSON
// document in the database (src/lib/day-checks-db.ts). This file is pure, so it can be tested on its own.

export interface CheckIn {
  repo: string;
  authors: string[];
  title: string;
  /** Criteria tagged [llm] that have a check, and criteria tagged [code]. */
  llm: number;
  code: number;
  /** An optional score from a review, 0 to 12. The jury's place decides, not this. */
  score: number;
  place: number | null;
  feedback: string | null;
  flags: string[];
}

export interface Candidate extends Omit<CheckIn, "place"> {
  /** When this repo was first sent in. */
  firstAt: string;
}

export interface ChecksDoc {
  candidates: Candidate[];
  /** The jury's places: repo name to 1, 2 or 3. */
  places: Record<string, number>;
  updatedAt: string | null;
}

export const EMPTY_CHECKS: ChecksDoc = { candidates: [], places: {}, updatedAt: null };
export const CHECKS_MAX_SCORE = 12;

const REPO = /^[\w.-]{1,100}$/;
const LOGIN = /^[\w-]{1,40}$/;
const int = (v: unknown, max: number): number | null => (typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= max ? v : null);
const text = (v: unknown, max: number): string => (typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max) : "");

export const isPlace = (v: unknown): v is 1 | 2 | 3 => v === 1 || v === 2 || v === 3;

/** Rows from the facts script. A row with a bad repo name or bad numbers is refused, with the reason. */
export function validateChecks(input: unknown): { ok: CheckIn[]; errors: string[] } {
  const ok: CheckIn[] = [];
  const errors: string[] = [];
  if (!Array.isArray(input)) return { ok, errors: ["checks must be a list"] };
  input.slice(0, 200).forEach((raw, i) => {
    const r = (raw ?? {}) as Record<string, unknown>;
    const repo = typeof r.repo === "string" ? r.repo : "";
    const llm = int(r.llm, 500);
    const code = int(r.code, 500);
    const score = r.score === undefined || r.score === null ? 0 : int(r.score, CHECKS_MAX_SCORE);
    if (!REPO.test(repo)) return void errors.push(`row ${i}: bad repo`);
    if (llm === null || code === null) return void errors.push(`row ${i}: llm and code must be whole numbers`);
    if (score === null) return void errors.push(`row ${i}: score must be 0 to ${CHECKS_MAX_SCORE}`);
    if (r.place !== undefined && r.place !== null && !isPlace(r.place)) return void errors.push(`row ${i}: place must be 1, 2 or 3`);
    const authors = (Array.isArray(r.authors) ? r.authors : []).filter((a): a is string => typeof a === "string" && LOGIN.test(a)).slice(0, 12);
    const flags = (Array.isArray(r.flags) ? r.flags : []).map((f) => text(f, 120)).filter(Boolean).slice(0, 10);
    ok.push({ repo, authors, title: text(r.title, 120) || repo, llm, code, score, place: isPlace(r.place) ? r.place : null, feedback: text(r.feedback, 300) || null, flags });
  });
  return { ok, errors };
}

/** Give a repo a place (or take it away with null). A place belongs to one repo at a time. */
export function setPlace(doc: ChecksDoc, repo: string, place: number | null, now: string): ChecksDoc {
  const places: Record<string, number> = {};
  for (const [name, p] of Object.entries(doc.places)) if (name !== repo && p !== place) places[name] = p;
  if (isPlace(place)) places[repo] = place;
  return { ...doc, places, updatedAt: now };
}

/** Take in rows from the facts script: new repos are added, known ones updated; the first time stays. */
export function mergeChecks(doc: ChecksDoc, rows: CheckIn[], now: string): ChecksDoc {
  const byRepo = new Map(doc.candidates.map((c) => [c.repo, c]));
  let out: ChecksDoc = doc;
  for (const { place, ...row } of rows) {
    byRepo.set(row.repo, { ...row, firstAt: byRepo.get(row.repo)?.firstAt ?? now });
    if (isPlace(place)) out = setPlace(out, row.repo, place, now);
  }
  return { candidates: [...byRepo.values()].sort((a, b) => a.repo.localeCompare(b.repo)), places: out.places, updatedAt: now };
}

/** Read a stored document defensively: anything that is not a document counts as empty. */
export function toChecksDoc(value: unknown): ChecksDoc {
  const v = value as Partial<ChecksDoc> | null;
  if (!v || !Array.isArray(v.candidates) || typeof v.places !== "object" || v.places === null) return EMPTY_CHECKS;
  return { candidates: v.candidates, places: v.places, updatedAt: typeof v.updatedAt === "string" ? v.updatedAt : null };
}
