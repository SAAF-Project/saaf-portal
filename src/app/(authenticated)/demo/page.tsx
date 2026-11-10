"use client";

import { useEffect, useState } from "react";

type Slot = { slot: string; taken: boolean; team?: string; title?: string; mine?: boolean };
type DemoState = { locked: boolean; slots: Slot[] };

export default function DemoPage() {
  const [state, setState] = useState<DemoState | null>(null);
  const [team, setTeam] = useState("");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function apply(data: DemoState) {
    setState(data);
    const mine = data.slots.find((s) => s.mine);
    if (mine) {
      setTeam(mine.team || "");
      setTitle(mine.title || "");
    }
  }

  async function reload() {
    const res = await fetch("/api/demo");
    if (res.ok) apply(await res.json());
  }

  useEffect(() => {
    let active = true;
    fetch("/api/demo")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: DemoState | null) => {
        if (active && data) apply(data);
      });
    return () => {
      active = false;
    };
  }, []);

  async function claim(slot: string) {
    setBusy(true);
    setMessage(null);
    const res = await fetch("/api/demo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slot, team, title }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    setMessage(res.ok ? `You present at ${data.slot}.` : data.error || "Something went wrong. Try again.");
    reload();
  }

  async function release() {
    setBusy(true);
    await fetch("/api/demo", { method: "DELETE" });
    setBusy(false);
    setMessage("Your slot is free again.");
    reload();
  }

  const mine = state?.slots.find((s) => s.mine);

  return (
    <div className="max-w-[620px] mx-auto py-8">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/saaf-lockup-ink.png" alt="SAAF, Shared Audit Agents Framework" className="h-6 w-auto mb-8 dark:invert" />
      <p className="text-xs font-mono text-muted mb-2">Security Challenge · 10 November 2026</p>
      <h1 className="text-2xl font-medium mb-3">Pick a five-minute demo slot.</h1>
      <p className="text-sm text-muted leading-relaxed mb-6">
        Demos run from 16:30 to 17:00: a click-through of your skill, workflow or CI check, offline on your own laptop.
        One slot per team. Fill in your team and the name of your guard, then pick a free slot.
      </p>

      <div className="bg-surface border border-border rounded-xl p-5 mb-4 grid gap-3">
        <label className="text-sm font-medium" htmlFor="team">Team name</label>
        <input id="team" value={team} onChange={(e) => setTeam(e.target.value)} maxLength={60}
          className="bg-bg border border-border rounded-lg px-3 py-2 text-sm" disabled={state?.locked} />
        <label className="text-sm font-medium" htmlFor="title">Name of your guard</label>
        <input id="title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100}
          className="bg-bg border border-border rounded-lg px-3 py-2 text-sm" disabled={state?.locked} />
      </div>

      <div className="bg-surface border border-border rounded-xl overflow-hidden mb-4">
        {state?.slots.map((s) => (
          <div key={s.slot} className="flex items-center gap-4 px-5 py-3 border-b border-border last:border-b-0">
            <span className="font-mono text-sm w-14">{s.slot}</span>
            <span className="flex-1 text-sm">
              {s.taken ? (
                <>
                  <span className="font-medium">{s.team}</span> <span className="text-muted">· {s.title}</span>
                </>
              ) : (
                <span className="text-muted">Free</span>
              )}
            </span>
            {!s.taken && !state.locked && (
              <button onClick={() => claim(s.slot)} disabled={busy}
                className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium disabled:opacity-50">
                {mine ? "Move here" : "Take slot"}
              </button>
            )}
            {s.mine && !state.locked && (
              <button onClick={release} disabled={busy} className="px-3 py-1.5 rounded-lg border border-border text-xs hover:border-accent">
                Release
              </button>
            )}
          </div>
        ))}
      </div>

      {message && <p className="text-sm mb-2">{message}</p>}
      {state?.locked && <p className="text-sm">Sign-up is closed. Demos are on.</p>}
      {!state && <p className="text-xs font-mono text-muted">Loading…</p>}
    </div>
  );
}
