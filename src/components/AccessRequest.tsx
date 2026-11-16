"use client";

import { useEffect, useState } from "react";

// "Request write access" for a repo that is not yours: to revive it, merge it with another, or help. Mathijs approves;
// access is then granted within a few minutes. Always write access, never admin.

type Req = { id: string; repo: string; reason: string; owner: string; status: "waiting" | "approved" | "granted" | "refused" };
const STATUS = { waiting: "waiting for Mathijs", approved: "approved, being granted", granted: "granted", refused: "not granted" } as const;
const field = "bg-bg border border-border rounded-lg px-3 py-2 text-sm";

export default function AccessRequest() {
  const [open, setOpen] = useState(false);
  const [repos, setRepos] = useState<string[]>([]);
  const [mine, setMine] = useState<Req[]>([]);
  const [repo, setRepo] = useState("");
  const [reason, setReason] = useState("revive");
  const [owner, setOwner] = useState("yes");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/access")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => alive && d && setMine(d.requests));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!open || repos.length > 0) return;
    let alive = true;
    fetch("/api/standards")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => alive && d?.repos && setRepos(d.repos.map((r: { name: string }) => r.name)));
    return () => {
      alive = false;
    };
  }, [open, repos.length]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    const res = await fetch("/api/access", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ repo, reason, owner, note }) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return setMessage(d.error || "Something went wrong");
    setMine(d.requests);
    setMessage("Sent. You will see the status here.");
    setRepo("");
    setNote("");
  };

  return (
    <section className="rounded-xl border border-border p-4 my-6 max-w-[720px]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Need to work on a repo that is not yours?</p>
          <p className="text-xs text-muted">You merge in your own repos. For someone else&apos;s, ask the creator first, then request write access here.</p>
        </div>
        <button onClick={() => setOpen(!open)} className="text-sm px-4 py-2 rounded-lg border border-border hover:border-accent">
          {open ? "Close" : "Request write access"}
        </button>
      </div>
      {open && (
        <form onSubmit={send} className="grid gap-2 mt-4 sm:grid-cols-2">
          <label className="text-xs text-muted sm:col-span-2" htmlFor="acc-repo">
            Repo
          </label>
          <select id="acc-repo" value={repo} onChange={(e) => setRepo(e.target.value)} required className={`${field} sm:col-span-2`}>
            <option value="">Choose a repo</option>
            {repos.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <label className="text-xs text-muted" htmlFor="acc-reason">
            Why
          </label>
          <label className="text-xs text-muted" htmlFor="acc-owner">
            Does the creator agree?
          </label>
          <select id="acc-reason" value={reason} onChange={(e) => setReason(e.target.value)} className={field}>
            <option value="revive">Revive a quiet agent</option>
            <option value="merge">Merge it with another repo</option>
            <option value="help">Help the team</option>
          </select>
          <select id="acc-owner" value={owner} onChange={(e) => setOwner(e.target.value)} className={field}>
            <option value="yes">Yes</option>
            <option value="no-answer">Asked, no answer yet</option>
            <option value="not-asked">Not asked</option>
          </select>
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="Anything Mathijs should know (optional)" className={`${field} sm:col-span-2`} />
          <button type="submit" className="text-sm px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white sm:col-span-2 justify-self-start">
            Send request
          </button>
        </form>
      )}
      {message && <p className="text-xs mt-2">{message}</p>}
      {mine.length > 0 && (
        <ul className="mt-3 text-xs font-mono text-muted">
          {mine.map((r) => (
            <li key={r.id}>
              {r.repo} · {STATUS[r.status]}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
