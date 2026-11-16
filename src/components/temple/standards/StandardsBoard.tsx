"use client";

import PrizesView from "./PrizesView";
import StandardsView from "./StandardsView";
import { usePrizes } from "./usePrizes";
import { useStandards } from "./useStandards";

/** The standards board, live: fetches the data, keeps it fresh and draws it, with the day's leaderboard above the table. */
export default function StandardsBoard() {
  const { payload, loaded } = useStandards();
  const prizes = usePrizes();
  return (
    <>
      <PrizesView payload={prizes} />
      <StandardsView payload={payload} loaded={loaded} fresh={prizes?.fresh} />
    </>
  );
}
