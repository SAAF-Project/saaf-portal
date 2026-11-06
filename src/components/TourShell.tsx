"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

/**
 * The portal's one step-by-step guide: a card with a progress bar, Back / Next / Skip, and optionally a spotlight on
 * the part of the page a step talks about. The dashboard's OnboardingWizard and the tour of every visualisation both
 * use it, so a guide looks and behaves the same everywhere.
 *
 * - A step without `target` is a centred dialog over a dimmed page (what the wizard always did).
 * - A step with `target` dims the page except that element (`data-tour="<target>"`) and puts the card next to it.
 * - A step with `target: "view"`, or a target that is not on the page, shows the card at the bottom without dimming, so
 *   the picture stays visible (the host moves the camera for such a step).
 */
export interface TourStepContent {
  title: string;
  body: ReactNode;
  target?: string; // value of a data-tour attribute
}

interface Props {
  steps: TourStepContent[];
  step: number; // 0-based
  onStep: (next: number) => void;
  onClose: (reason: "done" | "skip") => void;
  /** Label of the button on the last step. Without it the last step has no button (the step brings its own). */
  finishLabel?: string;
  skipLabel?: string;
  labelId?: string;
}

interface Box { top: number; left: number; width: number; height: number }

const PAD = 6;
const CARD_W = 360;

function findTarget(target: string | undefined): HTMLElement | null {
  if (!target || target === "view") return null;
  return document.querySelector<HTMLElement>(`[data-tour="${target}"]`);
}

function boxOf(el: HTMLElement): Box {
  const r = el.getBoundingClientRect();
  return { top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 };
}

/** Where the card goes next to a highlighted box: below it, or above when there is no room, kept inside the window. */
export function cardPosition(box: Box, viewport: { width: number; height: number }, cardHeight = 220): { top: number; left: number } {
  const margin = 12;
  const left = Math.min(Math.max(margin, box.left + box.width / 2 - CARD_W / 2), Math.max(margin, viewport.width - CARD_W - margin));
  const below = box.top + box.height + margin;
  const top = below + cardHeight <= viewport.height ? below : Math.max(margin, box.top - cardHeight - margin);
  return { top, left };
}

export function TourShell({ steps, step, onStep, onClose, finishLabel, skipLabel = "Skip for now", labelId = "tour-title" }: Props) {
  const current = steps[step];
  const last = step === steps.length - 1;
  const [box, setBox] = useState<Box | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [cardHeight, setCardHeight] = useState(220);

  // Follow the highlighted element: it can move when the window is resized or the page scrolls.
  useLayoutEffect(() => {
    const place = () => {
      const el = findTarget(current?.target);
      setBox(el ? boxOf(el) : null);
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [current?.target, step]);

  useEffect(() => {
    if (cardRef.current) setCardHeight(cardRef.current.offsetHeight);
  }, [step, box]);

  if (!current) return null;
  const centred = !current.target;
  const spotlight = box !== null;
  const style = spotlight
    ? { ...cardPosition(box, { width: window.innerWidth, height: window.innerHeight }, cardHeight), width: CARD_W }
    : undefined;

  const card = (
    <div ref={cardRef} className={`bg-surface border border-border rounded-2xl shadow-2xl ${centred ? "w-full max-w-lg" : spotlight ? "fixed" : "fixed bottom-20 left-1/2 -translate-x-1/2 w-[min(460px,calc(100%-24px))]"}`} style={style}>
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex gap-1.5">
          {steps.map((_, i) => (
            <div key={i} className={`h-1.5 rounded-full ${steps.length > 6 ? "w-4" : "w-8"} ${i <= step ? "bg-accent" : "bg-border"}`} />
          ))}
        </div>
        <button onClick={() => onClose("skip")} className="px-3 py-1 text-xs text-muted hover:text-text border border-border rounded-lg cursor-pointer">
          {skipLabel}
        </button>
      </div>
      <div className="p-6">
        <h2 id={labelId} className="text-lg font-bold mb-3">{current.title}</h2>
        {current.body}
      </div>
      <div className="flex gap-2 p-4 border-t border-border">
        <button
          onClick={() => onStep(Math.max(0, step - 1))}
          disabled={step === 0}
          className="px-4 py-2 text-sm border border-border rounded-lg text-muted hover:text-text disabled:opacity-30 cursor-pointer"
        >
          ← Back
        </button>
        <div className="flex-1" />
        {!last && (
          <button onClick={() => onStep(step + 1)} className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold cursor-pointer">
            Next →
          </button>
        )}
        {last && finishLabel && (
          <button onClick={() => onClose("done")} className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold cursor-pointer">
            {finishLabel}
          </button>
        )}
      </div>
    </div>
  );

  if (centred) {
    return (
      <div className="fixed inset-0 bg-bg/85 z-50 flex items-center justify-center p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby={labelId}>
        {card}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] pointer-events-none" role="dialog" aria-modal="false" aria-labelledby={labelId}>
      {spotlight && (
        // the dim comes from a huge shadow around the highlighted box, so the box itself stays clear and clickable-looking
        <div className="fixed rounded-xl border-2 border-accent pointer-events-none" style={{ top: box.top, left: box.left, width: box.width, height: box.height, boxShadow: "0 0 0 9999px rgb(5 10 25 / 0.55)" }} />
      )}
      <div className="pointer-events-auto">{card}</div>
    </div>
  );
}
