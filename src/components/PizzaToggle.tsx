"use client";

import { useEffect, useState } from "react";

type PizzaState = { choice: "yes" | "no" | null; yes: number; no: number; locked: boolean };

/** Yes or no to pizza at 17:30 on challenge day. */
export default function PizzaToggle() {
  const [state, setState] = useState<PizzaState | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/pizza")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: PizzaState | null) => {
        if (active && d) setState(d);
      });
    return () => {
      active = false;
    };
  }, []);

  async function choose(choice: "yes" | "no") {
    setBusy(true);
    const res = await fetch("/api/pizza", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ choice }),
    });
    if (res.ok) {
      const next = await fetch("/api/pizza");
      if (next.ok) setState(await next.json());
    }
    setBusy(false);
  }

  const option = (choice: "yes" | "no", label: string) => (
    <button
      type="button"
      onClick={() => choose(choice)}
      disabled={busy || state?.locked}
      aria-pressed={state?.choice === choice}
      className={`px-4 py-2 rounded-lg text-sm font-medium border disabled:opacity-50 ${
        state?.choice === choice ? "bg-indigo-600 border-indigo-600 text-white" : "border-border hover:border-accent"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="bg-surface border border-border rounded-xl p-5">
      <p className="text-xs font-mono text-muted mb-1">17:30 · after the prizes</p>
      <p className="font-medium mb-3">Do you stay for pizza.</p>
      <div className="flex flex-wrap gap-3 items-center">
        {option("yes", "Yes, I want pizza")}
        {option("no", "No, thanks")}
        {state && (
          <span className="text-xs font-mono text-muted">
            {state.locked ? "The order has gone out" : "Tell us by 16:00"} · {state.yes} yes
          </span>
        )}
      </div>
    </div>
  );
}
