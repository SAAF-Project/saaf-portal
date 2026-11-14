"use client";

import StandardsView from "./StandardsView";
import { useStandards } from "./useStandards";

/** The standards board, live: fetches the data, keeps it fresh and draws it. */
export default function StandardsBoard() {
  const { payload, loaded } = useStandards();
  return <StandardsView payload={payload} loaded={loaded} />;
}
