"use client";

import { useEffect, useState } from "react";
import type { LeaderboardPayload } from "../../lib/leaderboard-day";
import { STANDARDS } from "../temple/standards/standards";
import { clock } from "../temple/standards/StandardsView";

// The organisers' view of the day's leaderboard (Session 11): always the full, unfrozen standings per track, the review
// agent's flags, and the controls for the freeze, the reveal, the jury's places for track 3, disqualifying a login and
// overriding a level. MSACC only; the routes check that too.

const LABEL: Record<string, string> = Object.fromEntries(STANDARDS.map((s) => [s.id, s.label]));
const SCORED = ["readme", "agent-yaml", "audit-criteria", "tests", "ci", "dependencies", "licence", "codeowners"];
const btn = "px-3 py-1.5 text-sm rounded-lg border border-border hover:border-accent disabled:opacity-40";

export default function LeaderboardTab() {
  const [p, setP] = useState<LeaderboardPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [login, setLogin] = useState("");

  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const res = await fetch("/api/admin/leaderboard", { cache: "no-store" });
      if (!alive) return;
      if (!res.ok) return setError(`Could not load (${res.status})`);
      const body = (await res.json()) as LeaderboardPayload;
      if (!alive) return;
      setError(null);
      setP(body);
    };
    load();
    const t = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [tick]);

  const act = async (body: Record<string, unknown>) => {
    setBusy(true);
    const res = await fetch("/api/admin/leaderboard", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setBusy(false);
    if (!res.ok) return setError(`Action failed (${res.status})`);
    setError(null);
    setP(await res.json());
  };

  if (!p) return <p className="text-muted">{error ?? "Loading the leaderboard."}</p>;
  const a = p.admin!;
  const total = a.reveal_total;
  const byRise = p.prize === "most_improved";
  const place = async (repo: string, value: number | null) => {
    setBusy(true);
    const res = await fetch("/api/admin/checks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ place: { repo, place: value } }) });
    setBusy(false);
    if (!res.ok) return setError(`Could not set the place (${res.status})`);
    setError(null);
    setTick((n) => n + 1);
  };

  return (
    <div className="space-y-8">
      {error && <p className="text-sm text-saaf-red">{error}</p>}

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-border p-4">
          <p className="text-xs font-mono text-muted mb-2">Public board</p>
          <p className="text-sm mb-3">
            {a.state.revealStep > 0 ? `Revealing: step ${Math.min(a.state.revealStep, total)} of ${total}` : a.state.frozen ? `Frozen since ${a.state.freezeAt ? clock(a.state.freezeAt) : "now"}` : "Live (freezes by itself at 15:15)"}
          </p>
          <div className="flex flex-wrap gap-2">
            <button className={btn} disabled={busy} onClick={() => act({ action: a.state.frozen ? "unfreeze" : "freeze" })}>
              {a.state.frozen ? "Unfreeze" : "Freeze now"}
            </button>
          </div>
        </div>
        <div className="rounded-xl border border-border p-4">
          <p className="text-xs font-mono text-muted mb-2">Prize-giving</p>
          <p className="text-sm mb-3">
            First the two mentions (top contributor, {byRise ? "best agent" : "most improved"}), one step each. Then track 3, track 2 and track 1, each from
            the third place up to the winner. Enter the jury&apos;s places for track 3 below before you start.
          </p>
          <div className="flex flex-wrap gap-2">
            <button className={btn} disabled={busy} onClick={() => act({ action: "reveal-back" })}>
              Back
            </button>
            <button className={`${btn} border-accent text-accent`} disabled={busy || a.state.revealStep >= total} onClick={() => act({ action: "reveal-next" })}>
              Reveal next step
            </button>
            <button className={btn} disabled={busy} onClick={() => act({ action: "reveal-reset" })}>
              Reset
            </button>
          </div>
        </div>
        <div className="rounded-xl border border-border p-4">
          <p className="text-xs font-mono text-muted mb-2">Review agent</p>
          <p className="text-sm">
            {p.graded.states} states graded · {p.graded.pending} waiting
            <br />
            Last review {p.graded.last_at ? clock(p.graded.last_at) : "not yet"}
          </p>
        </div>
      </section>

      <section className="grid gap-8 lg:grid-cols-3">
        <List title={`Track 1 · Most improved${byRise ? " (the prize)" : ""}`} rows={p.most_improved.map((r) => [r.name, `+${r.gain} (${r.before} → ${r.after})`, r.by.join(", ")])} />
        <List title={`Best agent${byRise ? " (mention)" : " (the prize of track 1)"}`} rows={p.best_agent.map((r) => [r.name, `${r.after} pts (+${r.gain})`, r.by.join(", ")])} />
        <List title="Top contributor (mention)" rows={p.top_contributor.slice(0, 10).map((x) => [`@${x.login}`, `${x.points} pts`, `${x.repos.length} repos${x.capped ? `, ${x.capped} capped` : ""}`])} />
      </section>

      <section>
        <h3 className="text-base font-medium mb-2">Track 2 · Additions to the standards.</h3>
        <p className="text-xs text-muted mb-2">Advice from the standards review. Nothing is merged today; the sweep comes after.</p>
        <List title="" rows={p.proposals.map((x) => [x.title, `${x.score}/15`, `@${x.author} · ${x.repo} · ${x.kind} · ${x.verdict ?? ""}${x.feedback ? ` · ${x.feedback}` : ""}`])} />
      </section>

      <section>
        <h3 className="text-base font-medium mb-2">Track 3 · LLM checks.</h3>
        <p className="text-xs text-muted mb-2">
          The repos with an llm_checks.yaml, sent in by the facts script. The jury (Orq.ai and an auditor) picks the places at 16:15: click 1, 2 or 3. The public
          sees places only in the reveal.
        </p>
        {p.checks.length === 0 ? (
          <p className="text-sm text-muted">No repo has been sent in yet.</p>
        ) : (
          <ol className="border-t border-border text-sm">
            {p.checks.map((c) => (
              <li key={c.repo} className="grid grid-cols-[auto_1fr_auto] gap-x-3 items-center py-2 border-b border-border">
                <span className="inline-flex gap-1">
                  {[1, 2, 3].map((n) => (
                    <button
                      key={n}
                      className={`w-7 h-7 text-xs font-mono rounded-md border ${c.place === n ? "border-accent text-accent" : "border-border text-muted hover:border-accent"}`}
                      disabled={busy}
                      onClick={() => place(c.repo, c.place === n ? null : n)}
                      aria-label={`Place ${n} for ${c.repo}`}
                      aria-pressed={c.place === n}
                    >
                      {n}
                    </button>
                  ))}
                </span>
                <span className="min-w-0 [overflow-wrap:anywhere]">
                  <span className="font-medium">{c.repo}</span>
                  <span className="block text-xs text-muted">
                    {c.authors.map((l) => `@${l}`).join(" ")}
                    {c.feedback ? ` · ${c.feedback}` : ""}
                    {c.flags && c.flags.length > 0 ? ` · ${c.flags.join("; ")}` : ""}
                  </span>
                </span>
                <span className="font-mono tabular-nums text-muted">
                  {c.llm} llm · {c.code} code
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section>
        <h3 className="text-base font-medium mb-2">Flags from the review agent.</h3>
        {a.flagged.length === 0 ? (
          <p className="text-sm text-muted">None.</p>
        ) : (
          <ul className="border-t border-border text-sm">
            {a.flagged.slice(0, 60).map((f, i) => (
              <li key={i} className="py-2 border-b border-border">
                <span className="font-medium">{f.repo}</span> · {LABEL[f.standard] ?? f.standard}: <span className="text-muted">{f.flags.join("; ")}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap items-center gap-2 mt-3">
          <input value={login} onChange={(e) => setLogin(e.target.value.trim())} placeholder="GitHub login" className="px-3 py-1.5 text-sm rounded-lg border border-border bg-bg" />
          <button className={btn} disabled={busy || !login} onClick={() => act({ action: "disqualify", login })}>
            Disqualify
          </button>
          <button className={btn} disabled={busy || !login} onClick={() => act({ action: "requalify", login })}>
            Requalify
          </button>
          {a.state.disqualified.length > 0 && <span className="text-xs font-mono text-muted">Disqualified: {a.state.disqualified.join(", ")}</span>}
        </div>
      </section>

      <section>
        <h3 className="text-base font-medium mb-2">Every repo, as it stands now.</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left font-mono text-xs text-muted">
                <th className="py-2 pr-2">Repo</th>
                {SCORED.map((id) => (
                  <th key={id} className="py-2 px-1 text-center" title={LABEL[id]}>
                    {(LABEL[id] ?? id).replace(".md", "").slice(0, 8)}
                  </th>
                ))}
                <th className="py-2 pl-2 text-right">Points</th>
              </tr>
            </thead>
            <tbody>
              {a.repos.map((r) => (
                <tr key={r.name} className="border-t border-border align-top">
                  <td className="py-2 pr-2">
                    <span className="font-medium">{r.name}</span>
                    {r.pending > 0 && <span className="block text-xs text-muted">{r.pending} waiting for review</span>}
                    {Object.entries(r.feedback).slice(0, 2).map(([id, f]) => (
                      <span key={id} className="block text-xs text-muted">
                        {LABEL[id] ?? id}: {f}
                      </span>
                    ))}
                  </td>
                  {SCORED.map((id) => (
                    <td key={id} className="py-2 px-1 text-center">
                      <Override value={r.levels[id] ?? 0} disabled={busy || !r.tree} onSave={(level, note) => act({ action: "override", repo: r.name, tree: r.tree, standard: id, level, note })} />
                    </td>
                  ))}
                  <td className="py-2 pl-2 text-right font-mono tabular-nums">
                    {r.after} <span className="text-muted">({r.gain >= 0 ? "+" : ""}{r.gain})</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function List({ title, rows }: { title: string; rows: [string, string, string][] }) {
  return (
    <div>
      {title && <h3 className="text-base font-medium mb-2">{title}.</h3>}
      {rows.length === 0 ? (
        <p className="text-sm text-muted">Nobody yet.</p>
      ) : (
        <ol className="border-t border-border text-sm">
          {rows.map(([a, b, c], i) => (
            <li key={i} className="grid grid-cols-[1.5rem_1fr_auto] gap-x-2 py-2 border-b border-border">
              <span className="font-mono text-xs text-muted">{i + 1}</span>
              <span className="min-w-0 [overflow-wrap:anywhere]">
                {a}
                {c && <span className="block text-xs text-muted">{c}</span>}
              </span>
              <span className="font-mono tabular-nums">{b}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/** A level that an organiser can change, with a note, for the state the board shows now. */
function Override({ value, disabled, onSave }: { value: number; disabled: boolean; onSave: (level: number, note: string) => void }) {
  const [open, setOpen] = useState(false);
  const [level, setLevel] = useState(value);
  const [note, setNote] = useState("");
  if (!open) {
    return (
      <button className="font-mono tabular-nums px-1 rounded hover:bg-hover disabled:opacity-40" disabled={disabled} onClick={() => setOpen(true)} title="Override this level">
        {value}
      </button>
    );
  }
  return (
    <span className="inline-flex flex-col gap-1 items-center">
      <input type="number" min={0} max={3} value={level} onChange={(e) => setLevel(Number(e.target.value))} className="w-12 px-1 text-sm rounded border border-border bg-bg" />
      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="why" className="w-20 px-1 text-xs rounded border border-border bg-bg" />
      <span className="flex gap-1">
        <button className="text-xs text-accent" onClick={() => (onSave(level, note), setOpen(false))}>
          save
        </button>
        <button className="text-xs text-muted" onClick={() => setOpen(false)}>
          cancel
        </button>
      </span>
    </span>
  );
}
