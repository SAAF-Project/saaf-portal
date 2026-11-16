import { describe, expect, it } from "vitest";
import type { LeaderboardPayload } from "../../../lib/leaderboard-day";
import { prizesPollMs, REVEAL_POLL_MS, WAITING_POLL_MS } from "./usePrizes";

const payload = (over: Partial<LeaderboardPayload>): LeaderboardPayload => ({ phase: "during", frozen: false, reveal: null, ...over }) as LeaderboardPayload;

describe("how often the prizes are fetched", () => {
  it("once a minute during the day, faster after the close and fastest during the reveal", () => {
    expect(prizesPollMs(null, 60_000)).toBe(60_000);
    expect(prizesPollMs(payload({}), 60_000)).toBe(60_000);
    expect(prizesPollMs(payload({ frozen: true }), 60_000)).toBe(60_000); // frozen during the last hour of the day: still calm
    expect(prizesPollMs(payload({ phase: "after", frozen: true }), 60_000)).toBe(WAITING_POLL_MS);
    expect(prizesPollMs(payload({ phase: "after", reveal: { step: 1, total: 9 } }), 60_000)).toBe(REVEAL_POLL_MS);
    expect(prizesPollMs(payload({ phase: "after", reveal: { step: 1, total: 9 } }), 1_000)).toBe(1_000); // never slower than asked
  });
});
