"use client";

import { useEffect, useState } from "react";
import FindingRules from "@/components/FindingRules";
import PizzaToggle from "@/components/PizzaToggle";

type QuizState = { count: number; guess: number | null; locked: boolean; lockAt: string };

export default function QuizPage() {
  const [state, setState] = useState<QuizState | null>(null);
  const [value, setValue] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    const res = await fetch("/api/quiz");
    if (res.ok) {
      const data: QuizState = await res.json();
      setState(data);
      if (data.guess !== null) setValue(String(data.guess));
    }
  }

  useEffect(() => {
    let active = true;
    fetch("/api/quiz")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: QuizState | null) => {
        if (!active || !data) return;
        setState(data);
        if (data.guess !== null) setValue(String(data.guess));
      });
    return () => {
      active = false;
    };
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    const res = await fetch("/api/quiz", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ guess: Number(value) }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (res.ok) {
      setMessage(`Saved. Your guess is ${data.guess}.`);
      load();
    } else {
      setMessage(data.error || "Something went wrong. Try again.");
    }
  }

  return (
    <div className="max-w-[560px] mx-auto py-8">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/saaf-lockup-ink.png" alt="SAAF, Shared Audit Agents Framework" className="h-6 w-auto mb-8 dark:invert" />
      <p className="text-xs font-mono text-muted mb-2">Security Challenge · 10 November 2026</p>
      <h1 className="text-2xl font-medium mb-3">How many findings will we have at 17:00.</h1>
      <p className="text-sm text-muted leading-relaxed mb-6">
        Before today, two people searching with Claude had already found a number of security
        findings across the SAAF repositories. Today the teams add theirs. At 17:00 we count every
        distinct finding together. The closest guess wins.
      </p>

      <form onSubmit={submit} className="bg-surface border border-border rounded-xl p-5 mb-4">
        <label htmlFor="guess" className="block text-sm font-medium mb-2">
          Your guess
        </label>
        <div className="flex gap-3">
          <input
            id="guess"
            type="number"
            inputMode="numeric"
            min={0}
            max={100000}
            step={1}
            required
            disabled={state?.locked}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="flex-1 bg-bg border border-border rounded-lg px-3 py-2 text-base"
          />
          <button
            type="submit"
            disabled={saving || state?.locked}
            className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium disabled:opacity-50"
          >
            {state?.guess !== null && state?.guess !== undefined ? "Update" : "Submit"}
          </button>
        </div>
        {message && <p className="text-sm mt-3">{message}</p>}
        {state?.locked && <p className="text-sm mt-3">The quiz is closed. See you at the prize ceremony.</p>}
      </form>

      <p className="text-xs font-mono text-muted">
        {state ? `${state.count} ${state.count === 1 ? "guess" : "guesses"} so far · closes at 17:00` : "Loading…"}
      </p>

      <div className="mt-8">
        <PizzaToggle />
      </div>

      <section className="mt-10">
        <h2 className="text-xs font-mono text-muted mb-3">What counts as one finding</h2>
        <FindingRules />
        <p className="text-xs text-muted leading-relaxed mt-3">
          Severity does not change the count. The full handout is under Security Challenge, Handout.
        </p>
      </section>
    </div>
  );
}
