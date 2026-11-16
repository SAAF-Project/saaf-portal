"use client";

import { useEffect, useState } from "react";
import type { ChecksDoc } from "../../lib/day-checks";
import { JURY_MAX_SCORE, JURY_REASON_MAX, JURY_RESULT_EXAMPLE, JURY_RESULT_RULES, juryPartsText, juryScoreText, parseJuryResult, type JuryResult } from "../../lib/jury-result";
import { clock } from "../temple/standards/StandardsView";

// The result of track 3 (LLM checks), entered by the organisers at 16:15. The jury (Orq.ai and an auditor) delivers it
// as one JSON object in the shape of src/lib/jury-result.ts: paste it, check it, save it. Or enter it by hand per repo.
// Saving replaces every place, score and reason; the public sees them only in the reveal. MSACC only; the route
// checks that too.

export const WINNERS_PATH = "/standards/winners";
const btn = "px-3 py-1.5 text-sm rounded-lg border border-border hover:border-accent disabled:opacity-40";
const field = "px-2 py-1 text-sm rounded-md border border-border bg-transparent";

type Hand = Record<string, { place: string; score: string; reason: string }>;

/** The form as a result in the jury's shape: only repos the organiser said something about. Pure, so it is tested. */
export function resultFromForm(doc: ChecksDoc, hand: Hand, names: string, max: string): Record<string, unknown> {
  const results = doc.candidates.flatMap((c) => {
    const h = hand[c.repo] ?? { place: "", score: "", reason: "" };
    const parts = doc.jury?.results[c.repo]?.parts ?? {};
    const row: Record<string, unknown> = { repo: c.repo };
    if (h.place) row.place = Number(h.place);
    if (h.score.trim() !== "") row.score = Number(h.score.replace(",", "."));
    if (h.reason.trim()) row.reason = h.reason;
    if (Object.keys(parts).length > 0) row.parts = parts;
    return Object.keys(row).length > 1 ? [row] : [];
  });
  const jury = names
    .split("\n")
    .map((n) => n.trim())
    .filter(Boolean);
  return { saaf_jury_result: 1, track: 3, ...(jury.length ? { jury } : {}), max_score: Number(max) || JURY_MAX_SCORE, results };
}

const handOf = (doc: ChecksDoc): Hand =>
  Object.fromEntries(
    doc.candidates.map((c) => {
      const j = doc.jury?.results[c.repo];
      return [c.repo, { place: doc.places[c.repo] ? String(doc.places[c.repo]) : "", score: j?.score === null || j?.score === undefined ? "" : String(j.score), reason: j?.reason ?? "" }];
    }),
  );

function Preview({ result }: { result: JuryResult }) {
  return (
    <div className="mt-3">
      {result.errors.length > 0 && (
        <ul className="text-sm text-saaf-red mb-3 list-disc pl-5" role="alert">
          {result.errors.map((e, i) => (
            <li key={i}>{e}</li>
          ))}
        </ul>
      )}
      {result.rows.length > 0 && (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs font-mono text-muted border-b border-border">
              <th className="py-1.5 pr-3 font-normal">Place</th>
              <th className="py-1.5 pr-3 font-normal">Repo</th>
              <th className="py-1.5 pr-3 font-normal">Score</th>
              <th className="py-1.5 pr-3 font-normal">Parts</th>
              <th className="py-1.5 font-normal">Reason</th>
            </tr>
          </thead>
          <tbody>
            {result.rows.map((r) => (
              <tr key={r.repo} className="border-b border-border align-top">
                <td className="py-1.5 pr-3 font-mono">{r.place ? `P${r.place}` : "·"}</td>
                <td className="py-1.5 pr-3 font-medium [overflow-wrap:anywhere]">{r.repo}</td>
                <td className="py-1.5 pr-3 font-mono tabular-nums">{juryScoreText({ score: r.score, max: result.max })}</td>
                <td className="py-1.5 pr-3 font-mono text-xs text-muted">{juryPartsText(r.parts)}</td>
                <td className="py-1.5 text-muted">{r.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {result.ok && (
        <p className="text-xs font-mono text-muted mt-2">
          Correct: {result.rows.length} {result.rows.length === 1 ? "repo" : "repos"}, {result.rows.filter((r) => r.place).length} with a place
          {result.names.length ? ` · jury: ${result.names.join("; ")}` : ""}. Nothing is saved until you select Save.
        </p>
      )}
    </div>
  );
}

export default function Track3Tab() {
  const [doc, setDoc] = useState<ChecksDoc | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState("");
  const [checked, setChecked] = useState<JuryResult | null>(null);
  const [hand, setHand] = useState<Hand>({});
  const [names, setNames] = useState("");
  const [max, setMax] = useState(String(JURY_MAX_SCORE));
  const [sure, setSure] = useState(false);
  const [copied, setCopied] = useState(false);

  const take = (next: ChecksDoc) => {
    setDoc(next);
    setHand(handOf(next));
    setNames((next.jury?.names ?? []).join("\n"));
    setMax(String(next.jury?.max ?? JURY_MAX_SCORE));
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      const res = await fetch("/api/admin/checks", { cache: "no-store" });
      if (!alive) return;
      if (!res.ok) return setError(`Could not load (${res.status})`);
      take(((await res.json()) as { checks: ChecksDoc }).checks);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const save = async (result: unknown, done: string) => {
    setBusy(true);
    setNote(null);
    const res = await fetch("/api/admin/checks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ result }) });
    setBusy(false);
    const body = (await res.json().catch(() => null)) as { checks?: ChecksDoc; errors?: string[]; error?: string } | null;
    if (!res.ok || !body?.checks) {
      setError(body?.errors?.length ? `Not saved. ${body.errors.join(" ")}` : `Not saved (${res.status})`);
      return false;
    }
    setError(null);
    setNote(done);
    setSure(false);
    take(body.checks);
    return true;
  };

  if (!doc) return <p className="text-muted">{error ?? "Loading track 3."}</p>;
  const candidates = doc.candidates.map((c) => c.repo);
  const placed = [1, 2, 3].map((n) => Object.entries(doc.places).find(([, p]) => p === n)?.[0] ?? null);
  const set = (repo: string, patch: Partial<Hand[string]>) => setHand((h) => ({ ...h, [repo]: { ...(h[repo] ?? { place: "", score: "", reason: "" }), ...patch } }));

  return (
    <div className="space-y-10">
      {error && (
        <p className="text-sm text-saaf-red" role="alert">
          {error}
        </p>
      )}
      {note && <p className="text-sm text-accent">{note}</p>}

      <section className="grid gap-4 md:grid-cols-[2fr_1fr]">
        <div className="rounded-xl border border-border p-4">
          <p className="text-xs font-mono text-muted mb-2">The result as it stands</p>
          {placed.every((r) => r === null) ? (
            <p className="text-sm">No place entered yet. The prize-giving skips track 3 until there is one.</p>
          ) : (
            <ol className="text-sm">
              {placed.map((repo, i) => {
                const j = repo ? doc.jury?.results[repo] : undefined;
                return (
                  <li key={i} className="grid grid-cols-[2.5rem_1fr] gap-x-2 py-1">
                    <span className="font-mono text-muted">P{i + 1}</span>
                    <span className="[overflow-wrap:anywhere]">
                      {repo ?? "·"}
                      {j && doc.jury ? <span className="text-muted"> · {[juryScoreText({ score: j.score, max: doc.jury.max }), j.reason].filter(Boolean).join(" · ")}</span> : null}
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
          <p className="text-xs font-mono text-muted mt-2">
            {doc.jury?.enteredAt ? `Entered at ${clock(doc.jury.enteredAt)}` : "No scores or reasons entered"}
            {doc.jury?.names.length ? ` · jury: ${doc.jury.names.join("; ")}` : ""} · {doc.candidates.length} {doc.candidates.length === 1 ? "repo" : "repos"} in the list
          </p>
        </div>
        <div className="rounded-xl border border-border p-4">
          <p className="text-xs font-mono text-muted mb-2">Winners view</p>
          <p className="text-sm mb-3">The big-screen page for 17:00. It shows only what you reveal in the Leaderboard tab.</p>
          <a href={WINNERS_PATH} target="saaf-winners" className={`${btn} inline-block border-accent text-accent`}>
            Open the winners view
          </a>
        </div>
      </section>

      <section>
        <h3 className="text-base font-medium mb-1">Paste the jury&apos;s result.</h3>
        <p className="text-xs text-muted mb-2">One JSON object in the shape below. Check shows what it says and what is wrong; Save replaces every place, score and reason.</p>
        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setChecked(null);
          }}
          rows={7}
          spellCheck={false}
          aria-label="The jury's result as JSON"
          placeholder='{ "saaf_jury_result": 1, "track": 3, "results": [ ... ] }'
          className="w-full font-mono text-xs p-3 rounded-lg border border-border bg-transparent"
        />
        <div className="flex flex-wrap gap-2 mt-2">
          <button className={btn} disabled={busy || !text.trim()} onClick={() => setChecked(parseJuryResult(text, candidates))}>
            Check
          </button>
          <button
            className={`${btn} border-accent text-accent`}
            disabled={busy || !checked?.ok}
            onClick={async () => {
              if (await save(JSON.parse(text), `Saved at ${clock(new Date().toISOString())}.`)) {
                setText("");
                setChecked(null);
              }
            }}
          >
            Save
          </button>
          {sure ? (
            <button className={`${btn} border-saaf-red text-saaf-red`} disabled={busy} onClick={() => save(null, "Cleared: no places, scores or reasons.")}>
              Yes, clear the result
            </button>
          ) : (
            <button className={btn} disabled={busy} onClick={() => setSure(true)}>
              Clear the saved result
            </button>
          )}
        </div>
        {checked && <Preview result={checked} />}
      </section>

      <section>
        <h3 className="text-base font-medium mb-1">Or enter it by hand.</h3>
        <p className="text-xs text-muted mb-2">
          The repos with LLM checks, sent in by the facts script. Give a place to at most three; the score and one sentence are optional (at most {JURY_REASON_MAX} characters).
        </p>
        {doc.candidates.length === 0 ? (
          <p className="text-sm text-muted">No repo has been sent in yet.</p>
        ) : (
          <ol className="border-t border-border text-sm">
            {doc.candidates.map((c) => {
              const h = hand[c.repo] ?? { place: "", score: "", reason: "" };
              return (
                <li key={c.repo} className="grid gap-x-3 gap-y-1 items-center py-2 border-b border-border md:grid-cols-[7rem_5rem_minmax(0,1fr)_minmax(0,1.4fr)]">
                  <select value={h.place} onChange={(e) => set(c.repo, { place: e.target.value })} className={field} aria-label={`Place for ${c.repo}`}>
                    <option value="">no place</option>
                    <option value="1">P1</option>
                    <option value="2">P2</option>
                    <option value="3">P3</option>
                  </select>
                  <input value={h.score} onChange={(e) => set(c.repo, { score: e.target.value })} inputMode="decimal" placeholder="score" className={`${field} w-full font-mono`} aria-label={`Score for ${c.repo}`} />
                  <span className="min-w-0 [overflow-wrap:anywhere]">
                    <span className="font-medium">{c.repo}</span>
                    <span className="block text-xs text-muted">
                      {c.authors.map((a) => `@${a}`).join(" ")} · {c.llm} llm · {c.code} code{c.flags.length > 0 ? ` · ${c.flags.join("; ")}` : ""}
                    </span>
                  </span>
                  <input value={h.reason} onChange={(e) => set(c.repo, { reason: e.target.value })} maxLength={JURY_REASON_MAX} placeholder="one sentence for the room" className={`${field} w-full`} aria-label={`Reason for ${c.repo}`} />
                </li>
              );
            })}
          </ol>
        )}
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_8rem_auto] items-end mt-3">
          <label className="text-xs text-muted">
            The jury, one name per line
            <textarea value={names} onChange={(e) => setNames(e.target.value)} rows={2} className={`${field} w-full mt-1`} />
          </label>
          <label className="text-xs text-muted">
            Highest score
            <input value={max} onChange={(e) => setMax(e.target.value)} inputMode="numeric" className={`${field} w-full mt-1 font-mono`} />
          </label>
          <button className={`${btn} border-accent text-accent`} disabled={busy || doc.candidates.length === 0} onClick={() => save(resultFromForm(doc, hand, names, max), `Saved at ${clock(new Date().toISOString())}.`)}>
            Save what is entered by hand
          </button>
        </div>
      </section>

      <section>
        <h3 className="text-base font-medium mb-1">The shape, to send to the jury.</h3>
        <p className="text-xs text-muted mb-2">The jury&apos;s review tool writes its result like this. The repos in the example are made up.</p>
        <pre className="text-xs font-mono p-3 rounded-lg border border-border overflow-x-auto">{JURY_RESULT_EXAMPLE}</pre>
        <ul className="text-xs text-muted mt-2 space-y-1 max-w-[820px]">
          {JURY_RESULT_RULES.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
        <button
          className={`${btn} mt-3`}
          onClick={async () => {
            await navigator.clipboard.writeText(`${JURY_RESULT_EXAMPLE}\n\n${JURY_RESULT_RULES.map((r) => `- ${r}`).join("\n")}\n`);
            setCopied(true);
          }}
        >
          {copied ? "Copied" : "Copy the shape and its rules"}
        </button>
      </section>
    </div>
  );
}
