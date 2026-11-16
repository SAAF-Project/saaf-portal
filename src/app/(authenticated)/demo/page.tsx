"use client";

import { useEffect, useState } from "react";
import { DAY_TRACKS, trackOfKind } from "@/lib/day-tracks";
import type { DemoKind } from "@/lib/demo-sessions";

// Demo sign-up for the current session (src/lib/demo-sessions.ts). On the hardening day a demo belongs to one of the
// three tracks (src/lib/day-tracks.ts). The organisers choose six on the pitch, two per track; each gets five minutes
// (one to connect, three to tell, one for questions).

type Entry = { team: string; title: string; repo: string; kind: DemoKind | ""; link: string; mine: boolean; what?: string; why?: string };
type Slot = Entry & { start: string; end: string };
type DemoState = {
  session: { id: string; label: string; mode: "draw" | "select"; kinds: boolean; lockAt: string; windowStart: string; maxSlots: number; slotSeconds: number };
  locked: boolean;
  drawn: boolean;
  secondsPerTeam: number;
  teams: Entry[];
  schedule: Slot[] | null;
  /** The organiser before the opening: the page then offers both views. */
  organiser?: boolean;
};
/** Before the assignment opens the sign-up answers with this instead. */
type NotOpen = { notOpen: true; opens: string; organiser: boolean; session: { id: string; label: string } };

const kindLabel = (kind: DemoKind | ""): string => {
  const track = trackOfKind(kind);
  return track ? `Track ${track.number} · ${track.demo.label}` : "";
};
const field = "bg-bg border border-border rounded-lg px-3 py-2 text-sm";

export default function DemoPage() {
  const [state, setState] = useState<DemoState | null>(null);
  const [closed, setClosed] = useState<NotOpen | null>(null);
  // ?view=member: the organiser looks at the page the way a member sees it.
  const [asMember] = useState(() => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("view") === "member");
  const api = asMember ? "/api/demo?view=member" : "/api/demo";
  const [kind, setKind] = useState<DemoKind | "">("");
  const [team, setTeam] = useState("");
  const [title, setTitle] = useState("");
  const [what, setWhat] = useState("");
  const [why, setWhy] = useState("");
  const [repo, setRepo] = useState("");
  const [link, setLink] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function apply(data: DemoState | NotOpen) {
    if ("notOpen" in data) return setClosed(data);
    setClosed(null);
    setState(data);
    const mine = data.teams.find((t) => t.mine);
    if (mine) {
      setKind(mine.kind);
      setTeam(mine.team);
      setTitle(mine.title);
      setWhat(mine.what ?? "");
      setWhy(mine.why ?? "");
      setRepo(mine.repo);
      setLink(mine.link);
    }
  }

  async function reload() {
    const res = await fetch(api);
    if (res.ok) apply(await res.json());
  }

  useEffect(() => {
    let active = true;
    fetch(api)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: DemoState | NotOpen | null) => {
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
      body: JSON.stringify({ kind, team, title, what, why, repo, link }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    setMessage(res.ok ? `${data.team} is signed up. The organisers choose six demos at 16:15, two per track.` : data.error || "Something went wrong. Try again.");
    reload();
  }

  async function withdraw() {
    setBusy(true);
    await fetch("/api/demo", { method: "DELETE" });
    setBusy(false);
    setKind("");
    setTeam("");
    setTitle("");
    setWhat("");
    setWhy("");
    setRepo("");
    setLink("");
    setMessage("Your sign-up is withdrawn.");
    reload();
  }

  const mine = state?.teams.find((t) => t.mine);
  const closes = state ? new Date(state.session.lockAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "16:00";

  const organiserNote = (state?.organiser || closed?.organiser) && (
    <p className="mb-6 px-4 py-3 rounded-lg border border-dashed border-border text-sm flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
      <span>{asMember ? "Participant view: this is what members see until 09:00 on 17 November." : "Organiser view: members see this page from 09:00 on 17 November."}</span>
      <a href={asMember ? "/demo" : "/demo?view=member"} className="text-accent hover:underline whitespace-nowrap">
        {asMember ? "Back to the organiser view" : "View as participant"}
      </a>
    </p>
  );

  if (closed) {
    return (
      <div className="max-w-[640px] mx-auto py-8">
        {organiserNote}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/saaf-lockup-ink.png" alt="SAAF, Shared Audit Agents Framework" className="h-6 w-auto mb-8 dark:invert" />
        <p className="text-xs font-mono text-muted mb-2">{closed.session.label}</p>
        <h1 className="text-2xl font-medium mb-3">Demo sign-up opens at {closed.opens}.</h1>
        <p className="text-sm text-muted leading-relaxed">It opens together with the assignment of the day, on Tuesday 17 November.</p>
      </div>
    );
  }
  if (!state) {
    return (
      <div className="max-w-[640px] mx-auto py-8">
        <p className="text-sm text-muted">Loading the demo sign-up.</p>
      </div>
    );
  }

  return (
    <div className="max-w-[640px] mx-auto py-8">
      {organiserNote}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/saaf-lockup-ink.png" alt="SAAF, Shared Audit Agents Framework" className="h-6 w-auto mb-8 dark:invert" />
      <p className="text-xs font-mono text-muted mb-2">{state?.session.label ?? "Hardening day · 17 November 2026"}</p>
      <h1 className="text-2xl font-medium mb-3">Demo your lesson.</h1>
      <p className="text-sm text-muted leading-relaxed mb-6">
        Six demos from 16:30, two per track, five minutes each: one to connect your laptop, three to tell, one for questions.
        Sign up by {closes}; the organisers choose six on the pitch and post the order here. A demo slot is not a prize: the
        winners are revealed at 17:00.
      </p>

      {state?.schedule ? (
        <>
          <h2 className="text-xs font-mono text-muted mb-2">The demos · {Math.round(state.secondsPerTeam / 60)} minutes each</h2>
          <div className="bg-surface border border-border rounded-xl overflow-hidden mb-4">
            {state.schedule.map((s, i) => (
              <div key={i} className={`flex items-center gap-4 px-5 py-3 border-b border-border last:border-b-0 ${s.mine ? "bg-accent/10" : ""}`}>
                <span className="font-mono text-sm w-24">
                  {s.start}-{s.end}
                </span>
                <span className="flex-1 text-sm">
                  <span className="font-medium">{s.team}</span> <span className="text-muted">· {s.title}</span>
                  {s.kind && <span className="block text-xs font-mono text-muted">{kindLabel(s.kind)}</span>}
                </span>
                {s.mine && <span className="text-xs font-mono text-accent">you</span>}
              </div>
            ))}
          </div>
          {mine && !state.schedule.some((s) => s.mine) && <p className="text-sm text-muted">Thank you for signing up. Your demo is not among the six this time; share it in the WhatsApp group.</p>}
        </>
      ) : (
        <>
          <form onSubmit={register} className="bg-surface border border-border rounded-xl p-5 mb-4 grid gap-3">
            <fieldset className="grid gap-2" disabled={state?.locked}>
              <legend className="text-sm font-medium mb-1">What do you want to demo?</legend>
              {DAY_TRACKS.map((t) => (
                <label key={t.demo.kind} className="flex items-start gap-2 text-sm">
                  <input type="radio" name="kind" value={t.demo.kind} checked={kind === t.demo.kind} onChange={() => setKind(t.demo.kind)} required className="mt-1" />
                  <span>
                    <span className="font-medium">{t.demo.label}</span> <span className="text-xs font-mono text-muted">track {t.number}</span>
                    <span className="block text-xs text-muted">{t.demo.hint}</span>
                  </span>
                </label>
              ))}
            </fieldset>
            <label className="text-sm font-medium" htmlFor="team">Team or name</label>
            <input id="team" value={team} onChange={(e) => setTeam(e.target.value)} maxLength={60} required className={field} disabled={state?.locked} />
            <label className="text-sm font-medium" htmlFor="title">Title</label>
            <input id="title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} required placeholder="What your demo is called" className={field} disabled={state?.locked} />
            <label className="text-sm font-medium" htmlFor="what">The lesson, and what we will see</label>
            <textarea id="what" value={what} onChange={(e) => setWhat(e.target.value)} maxLength={600} required rows={3}
              placeholder="One sentence with the lesson, then what you will show in three minutes." className={field} disabled={state?.locked} />
            <label className="text-sm font-medium" htmlFor="why">Why others should hear it</label>
            <textarea id="why" value={why} onChange={(e) => setWhy(e.target.value)} maxLength={400} required rows={2} className={field} disabled={state?.locked} />
            <label className="text-sm font-medium" htmlFor="repo">
              Repository in SAAF-Project{" "}
              <span className="text-muted font-normal">{kind === "checks" ? "(the agent with your llm_checks.yaml, required)" : "(the agent you improved)"}</span>
            </label>
            <input id="repo" value={repo} onChange={(e) => setRepo(e.target.value)} maxLength={200} required={kind === "checks"} placeholder="SAAF-Project/my-agent" className={`${field} font-mono`} disabled={state?.locked} />
            <label className="text-sm font-medium" htmlFor="link">
              Pull requests <span className="text-muted font-normal">{kind === "standard" ? "(your proposal first, required; one per line)" : "(optional; one per line)"}</span>
            </label>
            <textarea id="link" value={link} onChange={(e) => setLink(e.target.value)} maxLength={700} required={kind === "standard"} rows={2}
              placeholder="https://github.com/SAAF-Project/agent-template/pull/12" className={`${field} font-mono`} disabled={state?.locked} />
            <p className="text-xs text-muted">The organisers read the lesson and the pitch; others see only your team and title.</p>
            {!state?.locked && (
              <div className="flex gap-3 mt-1">
                <button type="submit" disabled={busy} className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium disabled:opacity-50">
                  {mine ? "Update" : "Sign up"}
                </button>
                {mine && (
                  <button type="button" onClick={withdraw} disabled={busy} className="px-4 py-2 rounded-lg border border-border text-sm hover:border-accent">
                    Withdraw
                  </button>
                )}
              </div>
            )}
          </form>

          {state && state.teams.length > 0 && (
            <>
              <h2 className="text-xs font-mono text-muted mb-2">
                {state.teams.length} signed up · six are chosen, two per track
              </h2>
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
            </>
          )}
        </>
      )}

      {message && <p className="text-sm mb-2">{message}</p>}
      {state?.locked && !state.drawn && <p className="text-sm">Sign-up is closed. The six demos follow shortly.</p>}
      {!state && <p className="text-xs font-mono text-muted">Loading…</p>}
    </div>
  );
}
