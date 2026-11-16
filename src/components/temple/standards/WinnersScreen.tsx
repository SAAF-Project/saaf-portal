"use client";

import Link from "next/link";
import { useState } from "react";
import { usePrizes } from "./usePrizes";
import WinnersView, { stagesShown, type WinnersStage } from "./WinnersView";

// The winners view with its data: it asks for the public prizes every ten seconds, and every five once the reveal
// runs (usePrizes). By default it follows the prize-giving; the buttons below let the organiser go back to a part.

const WAITING_MS = 10_000;
const LABEL: Record<WinnersStage, string> = { waiting: "", mentions: "Mentions", checks: "Track 3", standard: "Track 2", agent: "Track 1", all: "All winners" };

function Live() {
  const payload = usePrizes(WAITING_MS);
  const [view, setView] = useState<"auto" | WinnersStage>("auto");
  const stages = stagesShown(payload);
  // A pinned part that is no longer revealed (the organiser went back or reset): follow the prize-giving again.
  const shownView = view !== "auto" && !stages.includes(view) ? "auto" : view;
  const full = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.();
  };
  return (
    <WinnersView
      payload={payload}
      view={shownView}
      footer={
        <footer className="win-foot font-mono">
          <span className="flex flex-wrap gap-2">
            {stages.length > 0 && (
              <button aria-pressed={shownView === "auto"} onClick={() => setView("auto")}>
                Follow the reveal
              </button>
            )}
            {stages.map((s) => (
              <button key={s} aria-pressed={shownView === s} onClick={() => setView(s)}>
                {LABEL[s]}
              </button>
            ))}
          </span>
          <span className="flex flex-wrap gap-2">
            <button onClick={full}>Full screen</button>
            <Link href="/standards">The board</Link>
          </span>
        </footer>
      }
    />
  );
}

export default function WinnersScreen({ open }: { /** The assignment is open for this viewer: before that there is nothing to ask for. */ open: boolean }) {
  if (!open) return <WinnersView payload={null} />;
  return <Live />;
}
