"use client";

import { useEffect, useState } from "react";
import { fetchJson } from "../../../lib/fetch-json";
import type { StandardsPayload } from "../../../lib/repo-standards";

/** How often the board asks for fresh data. The server asks GitHub at most once a minute, so faster gains nothing. */
export const POLL_MS = 60_000;

/**
 * What to show after a poll. A poll that fails, or that comes back without a board while one is on screen, keeps what
 * is on screen (marked stale in the second case); anything else replaces it.
 */
export function keepOnFail(shown: StandardsPayload | null, incoming: StandardsPayload | null): StandardsPayload | null {
  if (!incoming) return shown;
  if (incoming.repos === null && shown?.repos) return { ...shown, stale: true };
  return incoming;
}

/** The board's data: fetched on arrival and every minute while the tab is visible. `loaded` turns true after the first answer or failure. */
export function useStandards(pollMs: number = POLL_MS): { payload: StandardsPayload | null; loaded: boolean } {
  const [payload, setPayload] = useState<StandardsPayload | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      if (document.visibilityState !== "visible") return;
      const incoming = await fetchJson<StandardsPayload>("/api/standards");
      if (!alive) return;
      setPayload((shown) => keepOnFail(shown, incoming));
      setLoaded(true);
    };
    load();
    const timer = setInterval(load, pollMs);
    // a tab that comes back to the front catches up at once instead of waiting for the next tick
    document.addEventListener("visibilitychange", load);
    return () => {
      alive = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", load);
    };
  }, [pollMs]);

  return { payload, loaded };
}
