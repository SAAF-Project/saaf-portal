"use client";

import { useEffect, useState } from "react";
import { DAY_TRACKS, trackOfKind } from "../../lib/day-tracks";
import { DEMO_SESSIONS, CURRENT_DEMO_SESSION, overKind, type DemoKind } from "../../lib/demo-sessions";

// The organisers' view of the demo sign-up, per session. A draw session (10 November) shuffles the order; a select
// session (17 November) lets the organisers pick at most a few teams, in order, for fixed slots. The pitch check skill
// reads the same export (?session=&format=json) with the portal's admin token.

interface Row {
  id: string;
  team: string;
  title: string;
  kind?: DemoKind | "";
  link?: string;
  what?: string;
  why?: string;
  repo: string;
  githubUsername: string;
  name?: string | null;
  organisation?: string | null;
  start?: string;
  end?: string;
}

interface State {
  session: { id: string; label: string; mode: "draw" | "select"; maxSlots: number; maxPerKind?: number | null; slotSeconds: number; windowStart: string };
  drawn: boolean;
  locked: boolean;
  secondsPerTeam: number;
  teams: Row[];
  schedule: Row[] | null;
}

const kindLabel = (kind: DemoKind | "" | undefined): string => {
  const track = trackOfKind(kind ?? "");
  return track ? `Track ${track.number} · ${track.demo.label}` : "";
};
const btn = "text-xs px-3 py-2 rounded-lg border border-border hover:border-accent cursor-pointer disabled:opacity-50";

export default function DemosTab() {
  const [session, setSession] = useState(CURRENT_DEMO_SESSION);
  const [state, setState] = useState<State | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [uneven, setUneven] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    fetch(`/api/demo?session=${session}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: State | null) => {
        if (!alive) return;
        setState(d);
        setPicked(d?.schedule ? d.schedule.map((r) => r.id) : []);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [session, tick]);

  const reload = () => setTick((n) => n + 1);
  const post = async (body: Record<string, unknown>) => {
    setError(null);
    const res = await fetch("/api/demo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ session, ...body }) });
    if (!res.ok) setError((await res.json().catch(() => ({}))).error || "Failed");
    reload();
  };
  const clear = async () => {
    await fetch(`/api/demo?session=${session}&draw=clear`, { method: "DELETE" });
    reload();
  };
  const remove = async (id: string) => {
    await fetch(`/api/demo?session=${session}&id=${encodeURIComponent(id)}`, { method: "DELETE" });
    reload();
  };
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const move = (id: string, d: -1 | 1) =>
    setPicked((p) => {
      const i = p.indexOf(id);
      const j = i + d;
      if (i < 0 || j < 0 || j >= p.length) return p;
      const out = [...p];
      [out[i], out[j]] = [out[j], out[i]];
      return out;
    });

  if (state === null) return <div className="text-muted text-center py-12">Loading...</div>;
  const select = state.session.mode === "select";
  const rows = state.schedule ?? state.teams;
  const max = state.session.maxSlots;
  const perKind = state.session.maxPerKind ?? undefined;
  const pickedKinds = picked.map((id) => state.teams.find((t) => t.id === id)?.kind ?? "");
  const over = uneven ? [] : overKind(pickedKinds, perKind);

  return (
    <>
      <div className="bg-surface border border-border rounded-xl p-4 mb-6 flex flex-wrap items-center gap-3">
        <select value={session} onChange={(e) => setSession(e.target.value)} className="text-sm bg-bg border border-border rounded-lg px-2 py-1.5">
          {DEMO_SESSIONS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
        <div className="flex-1 min-w-[220px] text-sm">
          <span className="font-semibold">{state.teams.length} signed up</span>
          <span className="text-muted">
            {" "}
            · {select ? `choose at most ${max}, ${state.session.slotSeconds / 60} min each from ${state.session.windowStart}` : "random draw over 16:30-17:00"}
            {state.drawn ? " · order published" : state.locked ? " · sign-up closed" : ""}
          </span>
        </div>
        <button onClick={reload} className={btn}>
          Refresh
        </button>
        <a href={`/api/demo?session=${session}&format=csv`} className={btn}>
          CSV
        </a>
        <a href={`/api/demo?session=${session}&format=json`} className={btn}>
          JSON
        </a>
        {select ? (
          <>
            {perKind ? (
              <label className="text-xs text-muted inline-flex items-center gap-1">
                <input type="checkbox" checked={uneven} onChange={(e) => setUneven(e.target.checked)} /> uneven split
              </label>
            ) : null}
            <button
              onClick={() => post({ action: "select", ids: picked, uneven })}
              disabled={picked.length === 0 || picked.length > max || over.length > 0}
              className={`${btn} border-accent text-accent`}
            >
              Publish {picked.length} of {max}
            </button>
          </>
        ) : (
          <button onClick={() => post({ action: "draw" })} disabled={state.teams.length === 0} className={`${btn} border-accent text-accent`}>
            {state.drawn ? "Draw again" : "Draw order at random"}
          </button>
        )}
        {state.drawn && (
          <button onClick={clear} className={btn}>
            Unpublish
          </button>
        )}
      </div>
      {select && perKind && !state.drawn ? (
        <p className="text-xs font-mono text-muted mb-4">
          {DAY_TRACKS.map((t) => {
            const n = pickedKinds.filter((k) => k === t.demo.kind).length;
            const signed = state.teams.filter((r) => r.kind === t.demo.kind).length;
            return `Track ${t.number}: ${n} of ${perKind} picked (${signed} signed up)`;
          }).join(" · ")}
          {over.length > 0 ? " · more than two in one track: untick one, or tick uneven split" : ""}
        </p>
      ) : null}
      {error && <p className="text-sm text-saaf-red mb-4">{error}</p>}
      <div className="bg-surface border border-border rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted">
              <th className="px-4 py-3 font-medium">{state.drawn ? "Slot" : select ? "Pick" : "#"}</th>
              <th className="px-4 py-3 font-medium">Team and title</th>
              <th className="px-4 py-3 font-medium">Lesson · why others should hear it</th>
              <th className="px-4 py-3 font-medium">Repo and pull request</th>
              <th className="px-4 py-3 font-medium">Signed up by</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {(select && !state.drawn ? state.teams : rows).map((t, i) => {
              const at = picked.indexOf(t.id);
              return (
                <tr key={t.id} className={`border-b border-border align-top ${at >= 0 ? "bg-accent/10" : ""}`}>
                  <td className="px-4 py-3 font-mono whitespace-nowrap">
                    {state.drawn ? (
                      t.start ?? i + 1
                    ) : select ? (
                      <span className="inline-flex items-center gap-1">
                        <input type="checkbox" checked={at >= 0} onChange={() => toggle(t.id)} />
                        {at >= 0 && (
                          <>
                            <span className="text-xs">{at + 1}</span>
                            <button className="text-xs px-1" onClick={() => move(t.id, -1)} aria-label="Earlier">
                              ↑
                            </button>
                            <button className="text-xs px-1" onClick={() => move(t.id, 1)} aria-label="Later">
                              ↓
                            </button>
                          </>
                        )}
                      </span>
                    ) : (
                      i + 1
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-semibold">{t.team}</div>
                    <div className="text-muted text-xs">{t.title}</div>
                    {t.kind && <div className="text-xs font-mono text-accent mt-1">{kindLabel(t.kind)}</div>}
                  </td>
                  <td className="px-4 py-3 text-xs max-w-[420px]">
                    <div>{t.what}</div>
                    <div className="text-muted mt-1">{t.why}</div>
                  </td>
                  <td className="px-4 py-3 text-xs font-mono">
                    {t.repo ? (
                      <a href={`https://github.com/${t.repo}`} target="_blank" rel="noopener noreferrer" className="block hover:text-accent">
                        {t.repo.replace("SAAF-Project/", "")}
                      </a>
                    ) : null}
                    {t.link ? (
                      <a href={t.link} target="_blank" rel="noopener noreferrer" className="block hover:text-accent">
                        {t.link.replace("https://github.com/SAAF-Project/", "")}
                      </a>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-muted text-xs">{`${t.name || t.githubUsername} @${t.githubUsername}${t.organisation ? " · " + t.organisation : ""}`}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => remove(t.id)} className="text-xs px-2 py-1 rounded-lg border border-border hover:border-saaf-red cursor-pointer">
                      Remove
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
