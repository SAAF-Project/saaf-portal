"use client";

import { useEffect, useState } from "react";
import { fetchJson } from "../../../lib/fetch-json";
import type { LeaderboardPayload } from "../../../lib/leaderboard-day";
import { POLL_MS } from "./useStandards";

/** The prizes of the hardening day: fetched on arrival and every minute while the tab is visible. A failed poll keeps what is shown. */
export function usePrizes(pollMs: number = POLL_MS): LeaderboardPayload | null {
  const [payload, setPayload] = useState<LeaderboardPayload | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      if (document.visibilityState !== "visible") return;
      const incoming = await fetchJson<LeaderboardPayload>("/api/standards/prizes");
      if (alive && incoming) setPayload(incoming);
    };
    load();
    const timer = setInterval(load, pollMs);
    document.addEventListener("visibilitychange", load);
    return () => {
      alive = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", load);
    };
  }, [pollMs]);

  return payload;
}
