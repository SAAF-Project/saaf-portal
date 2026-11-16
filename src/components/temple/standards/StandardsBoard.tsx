"use client";

import PrizesView from "./PrizesView";
import StandardsView from "./StandardsView";
import { usePrizes } from "./usePrizes";
import { useStandards } from "./useStandards";

/** The standards board, live: fetches the data, keeps it fresh and draws it, with the day's leaderboard above the table. */
export default function StandardsBoard({ showDay = true }: { /** false before the assignment opens: the board without the day's leaderboard. */ showDay?: boolean }) {
  const { payload, loaded } = useStandards();
  const prizes = usePrizes();
  return (
    <>
      {showDay && <PrizesView payload={prizes} />}
      <StandardsView payload={payload} loaded={loaded} fresh={prizes?.fresh} />
    </>
  );
}
