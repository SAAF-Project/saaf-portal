"use client";

import { useEffect, useState } from "react";

// Write-access requests (src/lib/access.ts). Approve here; the Claude Code session on Mathijs's Mac grants write access
// with gh within a few minutes and marks the request granted. Always write, never maintain or admin.

type Req = { id: string; login: string; repo: string; reason: string; owner: string; note: string; status: string; createdAt: string };
const OWNER = { yes: "creator agrees", "no-answer": "creator did not answer", "not-asked": "creator not asked" } as Record<string, string>;
const btn = "text-xs px-3 py-1.5 rounded-lg border border-border hover:border-accent cursor-pointer";

export default function AccessTab() {
  const [rows, setRows] = useState<Req[] | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    fetch("/api/admin/access")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => alive && setRows(d?.requests ?? []));
    const t = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [tick]);

  const act = async (id: string, action: string) => {
    const res = await fetch("/api/admin/access", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, action }) });
    if (res.ok) setRows((await res.json()).requests);
  };

  if (rows === null) return <div className="text-muted text-center py-12">Loading...</div>;
  if (rows.length === 0) return <p className="text-muted">No requests yet.</p>;
  return (
    <div className="bg-surface border border-border rounded-xl overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted">
            <th className="px-4 py-3 font-medium">Who</th>
            <th className="px-4 py-3 font-medium">Repo</th>
            <th className="px-4 py-3 font-medium">Why</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium"></th>
          </tr>
        </thead>
        <tbody>
          {[...rows].reverse().map((r) => (
            <tr key={r.id} className="border-b border-border align-top">
              <td className="px-4 py-3 font-mono">@{r.login}</td>
              <td className="px-4 py-3">
                <a href={`https://github.com/SAAF-Project/${r.repo}`} target="_blank" rel="noopener noreferrer" className="hover:text-accent">
                  {r.repo}
                </a>
              </td>
              <td className="px-4 py-3 text-xs">
                {r.reason} · {OWNER[r.owner] ?? r.owner}
                {r.note && <span className="block text-muted">{r.note}</span>}
              </td>
              <td className="px-4 py-3 text-xs font-mono">{r.status}</td>
              <td className="px-4 py-3 text-right whitespace-nowrap">
                {(r.status === "waiting" || r.status === "refused") && (
                  <button onClick={() => act(r.id, "approve")} className={`${btn} border-accent text-accent mr-2`}>
                    Approve (write)
                  </button>
                )}
                {(r.status === "waiting" || r.status === "approved") && (
                  <button onClick={() => act(r.id, "refuse")} className={btn}>
                    Refuse
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
