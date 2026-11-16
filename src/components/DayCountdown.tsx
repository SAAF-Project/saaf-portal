"use client";

import { useSyncExternalStore } from "react";
import { DAY_DEADLINES } from "../lib/day-tracks";

// The countdown of the hardening day: the next deadline large, and every deadline with its own clock below it. It
// ticks once a second in the browser; the server and the first paint show the clock times only, so nothing jumps.

const tick = (onChange: () => void) => {
  const id = setInterval(onChange, 1000);
  return () => clearInterval(id);
};
const seconds = () => Math.floor(Date.now() / 1000);
const pad = (n: number) => String(n).padStart(2, "0");

/** What is left until a moment: "1:12:33" within a day, "45:10" within the hour, "2 days" before that. */
export function timeLeft(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s >= 86400) return `${Math.floor(s / 86400)} ${Math.floor(s / 86400) === 1 ? "day" : "days"}`;
  const h = Math.floor(s / 3600);
  return h > 0 ? `${h}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}` : `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
}

export default function DayCountdown({ fixedNow }: { /** A fixed moment instead of the clock, for previews and tests. */ fixedNow?: string }) {
  const ticking = useSyncExternalStore(tick, seconds, () => null);
  const now = fixedNow ? Date.parse(fixedNow) : ticking === null ? null : ticking * 1000;
  const rows = DAY_DEADLINES.map((d) => ({ ...d, ms: now === null ? null : Date.parse(d.at) - now }));
  const next = rows.find((r) => r.ms !== null && r.ms > 0);
  const last = rows[rows.length - 1];
  if (now !== null && last.ms !== null && last.ms < -2 * 3600 * 1000) return null; // two hours after the reveal: done
  const together = next ? rows.filter((r) => r.at === next.at) : [];

  return (
    <section aria-label="Deadlines of the day" className="rounded-2xl border border-border p-5 sm:p-6 mb-6">
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-2 mb-4">
        <div className="min-w-0">
          <p className="font-mono text-xs text-muted mb-1">{next ? `Next deadline · ${next.clock}` : now === null ? "Deadlines of the day" : "All deadlines have passed"}</p>
          <p className="text-2xl sm:text-3xl font-medium leading-tight">{next ? `${together.map((r) => r.label).join(" · ")}.` : now === null ? "17 November 2026." : "The day is closed."}</p>
        </div>
        {next && next.ms !== null && (
          <p className="text-4xl sm:text-5xl font-medium leading-none tabular-nums text-accent" role="timer" aria-live="off">
            {timeLeft(next.ms)}
          </p>
        )}
      </div>
      <ol className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 border-t border-border">
        {rows.map((r) => {
          const passed = r.ms !== null && r.ms <= 0;
          const isNext = !!next && r.at === next.at;
          return (
            <li key={r.label} className={`py-3 pr-3 border-b lg:border-b-0 border-border ${passed ? "opacity-50" : ""}`}>
              <p className="font-mono text-xs text-muted">{r.clock}</p>
              <p className={`text-sm leading-snug ${isNext ? "font-medium" : ""}`}>{r.label}</p>
              <p className="font-mono text-xs tabular-nums text-muted mt-1">{r.ms === null ? "\u00a0" : passed ? "passed" : `in ${timeLeft(r.ms)}`}</p>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
