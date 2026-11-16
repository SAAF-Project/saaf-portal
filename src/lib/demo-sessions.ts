// Demo sign-up per session. Every session keeps its own entries (Feedback rows under its own category, so no migration),
// its own close and its own way of choosing: a random draw that splits the window (10 November), or a selection by the
// organisers of at most `maxSlots` fixed slots (17 November). Old sessions stay readable in the admin.

/**
 * What a demo is about, one kind per track of the hardening day (src/lib/day-tracks.ts): the journey of one agent
 * (track 1), a better standard (track 2), or LLM checks (track 3).
 */
export const DEMO_KINDS = ["journey", "standard", "checks"] as const;
export type DemoKind = (typeof DEMO_KINDS)[number];
export const isDemoKind = (value: unknown): value is DemoKind => typeof value === "string" && (DEMO_KINDS as readonly string[]).includes(value);

export interface DemoSession {
  id: string;
  label: string;
  /** Feedback category of the entries, and of the order (draw or selection). */
  category: string;
  orderCategory: string;
  /** Sign-up closes at this moment (UTC). */
  lockAt: string;
  windowStart: string;
  windowMinutes: number;
  /** "draw": random order, the window split evenly. "select": the organisers pick at most maxSlots of slotSeconds. */
  mode: "draw" | "select";
  slotSeconds: number;
  maxSlots: number;
  /** Entries choose a kind, one per track of the day. */
  kinds: boolean;
  /** With kinds: at most this many selected demos per kind, unless the organisers say the split may be uneven. */
  maxPerKind?: number;
}

export const DEMO_SESSIONS: DemoSession[] = [
  {
    id: "2026-11-10",
    label: "Security Challenge · 10 November 2026",
    category: "demo-2026-11",
    orderCategory: "demo-draw-2026-11",
    lockAt: "2026-11-10T15:15:00Z",
    windowStart: "16:30",
    windowMinutes: 30,
    mode: "draw",
    slotSeconds: 300,
    maxSlots: 99,
    kinds: false,
  },
  {
    id: "2026-11-17",
    label: "Hardening day · 17 November 2026",
    category: "demo-2026-11-17",
    orderCategory: "demo-pick-2026-11-17",
    lockAt: "2026-11-17T15:00:00Z", // 16:00 in Amsterdam: the pitch check runs before the last merge at 16:15
    windowStart: "16:30",
    windowMinutes: 30,
    mode: "select",
    slotSeconds: 300, // 1 min to connect, 3 min to tell, 1 min for questions
    maxSlots: 6,
    kinds: true,
    maxPerKind: 2, // six demos, two per track
  },
];

export const CURRENT_DEMO_SESSION = "2026-11-17";

export function demoSession(id: string | null | undefined): DemoSession | null {
  return DEMO_SESSIONS.find((s) => s.id === (id || CURRENT_DEMO_SESSION)) ?? null;
}

/** The kinds that have more selected demos than the session allows per kind. Empty = the split is fine. */
export function overKind(kinds: (DemoKind | "")[], maxPerKind: number | undefined): DemoKind[] {
  if (!maxPerKind) return [];
  return DEMO_KINDS.filter((k) => kinds.filter((x) => x === k).length > maxPerKind);
}

/** A link to a pull request or repo in the SAAF-Project org, or "" when empty; null when it points elsewhere. */
export function normaliseLink(value: unknown): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const m = raw.match(/^https:\/\/github\.com\/SAAF-Project\/[\w.-]+(\/pull\/\d+)?\/?$/i);
  return m ? raw.replace(/\/$/, "") : null;
}
