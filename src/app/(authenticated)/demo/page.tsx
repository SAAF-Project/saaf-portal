"use client";

import { useEffect, useState } from "react";

type Team = { team: string; title: string; repo: string; mine: boolean; what?: string; why?: string };
type Slot = Team & { start: string; end: string };
type DemoState = { locked: boolean; drawn: boolean; secondsPerTeam: number; teams: Team[]; schedule: Slot[] | null };

const minutes = (s: number) => (s % 60 ? `${Math.floor(s / 60)} min ${s % 60} s` : `${s / 60} min`);

export default function DemoPage() {
  const [state, setState] = useState<DemoState | null>(null);
  const [team, setTeam] = useState("");
  const [title, setTitle] = useState("");
  const [what, setWhat] = useState("");
  const [why, setWhy] = useState("");
  const [repo, setRepo] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function apply(data: DemoState) {
    setState(data);
    const mine = data.teams.find((t) => t.mine);
    if (mine) {
      setTeam(mine.team);
      setTitle(mine.title);
      setWhat(mine.what ?? "");
      setWhy(mine.why ?? "");
      setRepo(mine.repo);
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

  async function register(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    const res = await fetch("/api/demo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ team, title, what, why, repo }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    setMessage(res.ok ? `${data.team} is signed up for a demo.` : data.error || "Something went wrong. Try again.");
    reload();
  }

  async function withdraw() {
    setBusy(true);
    await fetch("/api/demo", { method: "DELETE" });
    setBusy(false);
    setTeam("");
    setTitle("");
    setWhat("");
    setWhy("");
    setRepo("");
    setMessage("Your team is withdrawn.");
    reload();
  }

  const mine = state?.teams.find((t) => t.mine);

  return (
    <div className="max-w-[620px] mx-auto py-8">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/saaf-lockup-ink.png" alt="SAAF, Shared Audit Agents Framework" className="h-6 w-auto mb-8 dark:invert" />
      <p className="text-xs font-mono text-muted mb-2">Security Challenge · 10 November 2026</p>
      <h1 className="text-2xl font-medium mb-3">Sign up your team for a demo.</h1>
      <p className="text-sm text-muted leading-relaxed mb-6">
        Demos run from 16:30 to 17:00: a click-through of your skill, workflow or CI check, offline on your own laptop.
        One sign-up per team. Sign up by 16:15; then the order is drawn at random and the half hour is split evenly: five
        minutes each at most, less when more teams sign up.
      </p>

      {state?.schedule ? (
        <>
          <h2 className="text-xs font-mono text-muted mb-2">Drawn order · {minutes(state.secondsPerTeam)} per team</h2>
          <div className="bg-surface border border-border rounded-xl overflow-hidden mb-4">
            {state.schedule.map((s, i) => (
              <div key={i} className={`flex items-center gap-4 px-5 py-3 border-b border-border last:border-b-0 ${s.mine ? "bg-accent/10" : ""}`}>
                <span className="font-mono text-sm w-20">{s.start}</span>
                <span className="flex-1 text-sm">
                  <span className="font-medium">{s.team}</span> <span className="text-muted">· {s.title}</span>
                </span>
                {s.mine && <span className="text-xs font-mono text-accent">you</span>}
              </div>
            ))}
          </div>
          {!mine && <p className="text-sm text-muted">Your team is not in the draw. Ask an organiser.</p>}
        </>
      ) : (
        <>
          <form onSubmit={register} className="bg-surface border border-border rounded-xl p-5 mb-4 grid gap-3">
            <label className="text-sm font-medium" htmlFor="team">Team name</label>
            <input id="team" value={team} onChange={(e) => setTeam(e.target.value)} maxLength={60} required
              className="bg-bg border border-border rounded-lg px-3 py-2 text-sm" disabled={state?.locked} />
            <label className="text-sm font-medium" htmlFor="title">Name of your guard</label>
            <input id="title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} required
              placeholder="Give it a cool name" className="bg-bg border border-border rounded-lg px-3 py-2 text-sm" disabled={state?.locked} />
            <label className="text-sm font-medium" htmlFor="what">What you built and will show</label>
            <textarea id="what" value={what} onChange={(e) => setWhat(e.target.value)} maxLength={600} required rows={3}
              placeholder="Which finding it stops, how it works, what we will see in the demo."
              className="bg-bg border border-border rounded-lg px-3 py-2 text-sm" disabled={state?.locked} />
            <label className="text-sm font-medium" htmlFor="why">Why you should win</label>
            <textarea id="why" value={why} onChange={(e) => setWhy(e.target.value)} maxLength={400} required rows={2}
              className="bg-bg border border-border rounded-lg px-3 py-2 text-sm" disabled={state?.locked} />
            <label className="text-sm font-medium" htmlFor="repo">
              Repository in SAAF-Project <span className="text-muted font-normal">(optional, helps the jury)</span>
            </label>
            <input id="repo" value={repo} onChange={(e) => setRepo(e.target.value)} maxLength={200}
              placeholder="SAAF-Project/my-guard or a github.com link"
              className="bg-bg border border-border rounded-lg px-3 py-2 text-sm font-mono" disabled={state?.locked} />
            <p className="text-xs text-muted">The jury reads what you built and why you should win; other teams see only your team and guard name.</p>
            {!state?.locked && (
              <div className="flex gap-3 mt-1">
                <button type="submit" disabled={busy}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium disabled:opacity-50">
                  {mine ? "Update" : "Sign up"}
                </button>
                {mine && (
                  <button type="button" onClick={withdraw} disabled={busy}
                    className="px-4 py-2 rounded-lg border border-border text-sm hover:border-accent">
                    Withdraw
                  </button>
                )}
              </div>
            )}
          </form>

          {state && (
            <>
              <h2 className="text-xs font-mono text-muted mb-2">
                {state.teams.length} {state.teams.length === 1 ? "team" : "teams"} signed up · {minutes(state.secondsPerTeam)} each so far
              </h2>
              {state.teams.length > 0 && (
                <div className="bg-surface border border-border rounded-xl overflow-hidden mb-4">
                  {state.teams.map((t, i) => (
                    <div key={i} className="flex items-center gap-4 px-5 py-3 border-b border-border last:border-b-0 text-sm">
                      <span className="flex-1">
                        <span className="font-medium">{t.team}</span> <span className="text-muted">· {t.title}</span>
                      </span>
                      {t.mine && <span className="text-xs font-mono text-accent">you</span>}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}

      {message && <p className="text-sm mb-2">{message}</p>}
      {state?.locked && !state.drawn && <p className="text-sm">Sign-up is closed. The order follows shortly.</p>}
      {!state && <p className="text-xs font-mono text-muted">Loading…</p>}
    </div>
  );
}
