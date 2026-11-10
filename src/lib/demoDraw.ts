// Fair demo schedule for the Security Challenge: every registered team gets the same share
// of the demo window, at most five minutes, in an order drawn at random by the admin.

export const WINDOW_START = "16:30";
export const WINDOW_MINUTES = 30;
export const MAX_SECONDS = 300;
const STEP_SECONDS = 30;

/** Seconds per team: the window split evenly, rounded down to 30 s, never more than five minutes. */
export function secondsPerTeam(teams: number): number {
  if (teams <= 0) return MAX_SECONDS;
  const even = Math.floor((WINDOW_MINUTES * 60) / teams / STEP_SECONDS) * STEP_SECONDS;
  return Math.max(STEP_SECONDS, Math.min(MAX_SECONDS, even));
}

/** "16:30" plus an offset in seconds, as "16:34" or "16:34:30". */
export function clock(offsetSeconds: number, start: string = WINDOW_START): string {
  const [h, m] = start.split(":").map(Number);
  const total = h * 3600 + m * 60 + offsetSeconds;
  const hh = String(Math.floor(total / 3600)).padStart(2, "0");
  const mm = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
  const ss = total % 60;
  return ss ? `${hh}:${mm}:${String(ss).padStart(2, "0")}` : `${hh}:${mm}`;
}

/** Fisher-Yates shuffle with an injectable random source (crypto in production, seeded in tests). */
export function shuffle<T>(items: readonly T[], randomInt: (maxExclusive: number) => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export interface Slot<T> {
  start: string;
  end: string;
  item: T;
}

/** Back-to-back slots from the window start, one per item in the given order. */
export function schedule<T>(ordered: readonly T[]): { seconds: number; slots: Slot<T>[] } {
  const seconds = secondsPerTeam(ordered.length);
  return {
    seconds,
    slots: ordered.map((item, i) => ({ start: clock(i * seconds), end: clock((i + 1) * seconds), item })),
  };
}

const ORG = "SAAF-Project";

/** Accepts "name", "SAAF-Project/name" or a github.com URL into the org; returns "SAAF-Project/name", "" or null. */
export function normaliseRepo(value: unknown): string | null {
  let raw = String(value ?? "").trim();
  if (!raw) return "";
  // Full URL: only github.com, and only the SAAF-Project org; anything after the repo name is dropped.
  const url = raw.match(/^(?:https?:\/\/)?(?:www\.)?github\.com\/([^/?#]+)\/([^/?#]+)(?:[/?#].*)?$/i);
  if (url) {
    if (url[1].toLowerCase() !== ORG.toLowerCase()) return null;
    raw = url[2];
  } else if (raw.includes("/")) {
    // "SAAF-Project/name" only.
    const [org, name, ...rest] = raw.split("/");
    if (rest.length || org.toLowerCase() !== ORG.toLowerCase()) return null;
    raw = name;
  }
  raw = raw.replace(/\.git$/i, "");
  if (!/^[A-Za-z0-9._-]{1,100}$/.test(raw) || /^\.+$/.test(raw)) return null;
  return `${ORG}/${raw}`;
}
