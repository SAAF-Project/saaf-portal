"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Role = "hacker" | "dev" | "auditor";
type Member = { githubUsername: string; name: string | null; organisation: string | null; role: Role };
type Team = { number: number; members: Member[] };
type TeamsState = {
  role: Role | null;
  counts: Record<Role, number>;
  drawn: boolean;
  myTeam: Team | null;
  teams: Team[];
};

const LABEL: Record<Role, string> = { hacker: "Hacker", dev: "Developer", auditor: "Auditor" };
const HINT: Record<Role, string> = {
  hacker: "You break things: pentest, red team, security research.",
  dev: "You build things: code, CI, agents.",
  auditor: "You judge things: controls, evidence, risk.",
};

function TeamCard({ team, mine }: { team: Team; mine?: boolean }) {
  return (
    <div className={`border rounded-xl p-4 ${mine ? "border-accent bg-accent/10" : "border-border bg-surface"}`}>
      <p className="text-xs font-mono text-muted mb-2">Team {team.number}{mine ? " · you" : ""}</p>
      <ul className="grid gap-1 text-sm">
        {team.members.map((m) => (
          <li key={m.githubUsername} className="flex justify-between gap-3">
            <span>{m.name || m.githubUsername} <span className="text-muted text-xs">{m.organisation || ""}</span></span>
            <span className="text-xs font-mono text-muted">{LABEL[m.role]}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function TeamsPage() {
  const [state, setState] = useState<TeamsState | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    const res = await fetch("/api/teams");
    if (res.ok) setState(await res.json());
  }, []);

  useEffect(() => {
    let active = true;
    const tick = () =>
      fetch("/api/teams")
        .then((r) => (r.ok ? r.json() : null))
        .then((d: TeamsState | null) => {
          if (active && d) setState(d);
        });
    tick();
    // Everyone waits for the draw at the same time, so check again every ten seconds.
    const timer = setInterval(tick, 10_000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  async function choose(role: Role) {
    setBusy(true);
    await fetch("/api/teams", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role }) });
    await reload();
    setBusy(false);
  }

  return (
    <div className="max-w-[720px] mx-auto py-8">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/saaf-lockup-ink.png" alt="SAAF, Shared Audit Agents Framework" className="h-6 w-auto mb-8 dark:invert" />
      <p className="text-xs font-mono text-muted mb-2">Security Challenge · 10 November 2026</p>
      <h1 className="text-2xl font-medium mb-3">Find your team.</h1>
      <p className="text-sm text-muted leading-relaxed mb-6">
        Say what you are. At 14:55 we mix the teams: every team has at least a hacker or a developer, and where the
        numbers allow a hacker, a developer and an auditor. Then pick a team name when you sign up for a demo.
      </p>

      <div className="grid sm:grid-cols-3 gap-3 mb-3">
        {(["hacker", "dev", "auditor"] as Role[]).map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => choose(r)}
            disabled={busy}
            aria-pressed={state?.role === r}
            className={`text-left rounded-xl border p-4 disabled:opacity-50 ${
              state?.role === r ? "bg-indigo-600 border-indigo-600 text-white" : "border-border bg-surface hover:border-accent"
            }`}
          >
            <span className="block font-medium mb-1">{LABEL[r]}</span>
            <span className={`block text-xs ${state?.role === r ? "text-white/80" : "text-muted"}`}>{HINT[r]}</span>
          </button>
        ))}
      </div>
      {state && (
        <p className="text-xs font-mono text-muted mb-8">
          {state.counts.hacker} hackers · {state.counts.dev} developers · {state.counts.auditor} auditors
        </p>
      )}

      {state?.drawn ? (
        <>
          {state.myTeam ? (
            <div className="mb-6"><TeamCard team={state.myTeam} mine /></div>
          ) : (
            <p className="text-sm mb-6">
              {state.role ? "The teams are made. You are on the list for the next round; tell an organiser you are here." : "Pick a role above, then tell an organiser you are here."}
            </p>
          )}
          <h2 className="text-xs font-mono text-muted mb-2">All teams</h2>
          <div className="grid sm:grid-cols-2 gap-3 mb-8">
            {state.teams.filter((t) => t.number !== state.myTeam?.number).map((t) => <TeamCard key={t.number} team={t} />)}
          </div>
        </>
      ) : (
        state && <p className="text-sm text-muted mb-8">Teams appear here after the draw. This page refreshes by itself.</p>
      )}

      <p className="text-sm">
        Next: <Link href="/quiz" className="text-accent hover:underline">guess the total in the quiz</Link> and{" "}
        <Link href="/demo" className="text-accent hover:underline">sign up for a demo</Link> by 16:15.
      </p>
      {!state && <p className="text-xs font-mono text-muted mt-4">Loading…</p>}
    </div>
  );
}
