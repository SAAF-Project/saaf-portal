"use client";

import { useEffect, useState } from "react";
import { fetchJson } from "../../../lib/fetch-json";
import type { LeaderboardPayload } from "../../../lib/leaderboard-day";
import { POLL_MS } from "./useStandards";

/** While the organisers reveal the places, a click should show within seconds. */
export const REVEAL_POLL_MS = 5_000;
/** After the close, while the result is still hidden: the first reveal step should not take a minute to show. */
export const WAITING_POLL_MS = 10_000;

/** How often to ask again, given what is on screen. */
export function prizesPollMs(payload: LeaderboardPayload | null, pollMs: number = POLL_MS): number {
  if (payload?.reveal) return Math.min(pollMs, REVEAL_POLL_MS);
  if (payload?.frozen && payload.phase === "after") return Math.min(pollMs, WAITING_POLL_MS);
  return pollMs;
}

/**
 * The prizes of the hardening day: fetched on arrival and every minute while the tab is visible, faster around the
 * reveal. A failed poll keeps what is shown.
 */
export function usePrizes(pollMs: number = POLL_MS): LeaderboardPayload | null {
  const [payload, setPayload] = useState<LeaderboardPayload | null>(null);
  const every = prizesPollMs(payload, pollMs);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      if (document.visibilityState !== "visible") return;
      const incoming = await fetchJson<LeaderboardPayload>("/api/standards/prizes");
      if (alive && incoming) setPayload(incoming);
    };
    load();
    const timer = setInterval(load, every);
    document.addEventListener("visibilitychange", load);
    return () => {
      alive = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", load);
    };
  }, [every]);

  return payload;
}
