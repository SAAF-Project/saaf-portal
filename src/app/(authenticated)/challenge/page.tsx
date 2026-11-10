import Link from "next/link";

// The Security Challenge handout (10 November 2026) as a page, with the printable PDF next to it.
// Keep the text in step with public/challenge/saaf-security-challenge-handout.pdf.

const PDF = "/challenge/saaf-security-challenge-handout.pdf";

const guards = [
  { name: "Skill", text: "For example an injection guard that marks auditee documents as data, not instructions." },
  { name: "Workflow", text: "For example a secret scan over the full git history on every push." },
  { name: "CI check", text: "For example a dependency audit that fails the build on a critical advisory." },
];

const handIn = [
  { k: "Subject", v: <code className="font-mono text-xs">SAAF findings: your team name</code> },
  { k: "How often", v: "As often as you like. Every mail adds to your team's count; repeats are removed." },
  { k: "Format", v: "One plain .csv attachment per mail. No zip, Excel, PDF or links: those are ignored." },
  { k: "Deadline", v: "Last CSV before 16:30." },
];

const counts = [
  { k: "Counts", v: "One weakness in one place: a repo plus file, endpoint or site; behaviour that is not what was intended or safe; a plausible security, privacy or audit impact." },
  { k: "Once", v: "The same root cause in one repo counts once." },
  { k: "Per repo", v: "The same issue in three repos counts three times." },
  { k: "Not new", v: "Anything already among the 127 found before today, false positives, third-party services, repos outside SAAF-Project." },
  { k: "Never", v: "No live keys or secret values, no personal data, no attacks on live systems. Local copies only; live sites passive only." },
];

const afternoon = [
  { t: "14:15", v: "Build in teams. Mail your CSV whenever you have one." },
  { t: "by 16:15", v: <>Sign up your team at <Link href="/demo" className="text-accent hover:underline">Demo sign-up</Link>: team name, guard name, what you built, why you should win, your SAAF repo.</> },
  { t: "16:30", v: "Demos: click-through, offline on your own laptop. No live cloud fixes. Order drawn at random; the half hour is split evenly, five minutes at most.", accent: true },
  { t: "17:00", v: "The jury deliberates for ten minutes. Grab a drink." },
  { t: "17:10", v: "Prizes, and the quiz winner." },
];

function Rows({ rows }: { rows: { k: string; v: React.ReactNode }[] }) {
  return (
    <dl className="border-t border-border">
      {rows.map((r) => (
        <div key={r.k} className="grid grid-cols-[88px_1fr] gap-3 py-2 border-b border-border text-sm">
          <dt className="font-medium">{r.k}</dt>
          <dd className="text-muted leading-relaxed">{r.v}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function ChallengePage() {
  return (
    <div className="max-w-[880px] mx-auto py-8">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/saaf-lockup-ink.png" alt="SAAF, Shared Audit Agents Framework" className="h-6 w-auto dark:invert" />
        <a href={PDF} download className="text-sm px-4 py-2 rounded-lg border border-border hover:border-accent">
          Download the handout (PDF)
        </a>
      </div>

      <p className="text-xs font-mono text-muted mb-2">Security Challenge · Session #10 · Mollie Amsterdam · 10 November 2026</p>
      <h1 className="text-3xl font-medium leading-tight mb-3">
        Build one guard that <span className="text-accent">stops a bad actor.</span>
      </h1>
      <p className="text-muted leading-relaxed mb-8 max-w-[680px]">
        Find weaknesses in the SAAF agents, then turn what you learn into a skill, a workflow or a CI check that any SAAF
        repository can reuse. Give it a name. Prizes for the best three.
      </p>

      <div className="grid gap-6 sm:grid-cols-3 mb-10">
        {guards.map((g) => (
          <div key={g.name} className="border-t border-border pt-3">
            <div className="font-medium mb-1">{g.name}</div>
            <p className="text-sm text-muted leading-relaxed">{g.text}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2 mb-10">
        <section className="bg-accent/10 rounded-2xl p-5 min-w-0">
          <h2 className="text-xs font-mono text-muted mb-2">Hand in your findings</h2>
          <p className="text-lg font-medium mb-3">
            Mail a CSV to <a href="mailto:info@saafproject.com" className="text-accent">info@saafproject.com</a>
          </p>
          <Rows rows={handIn} />
          <div className="flex flex-wrap gap-2 my-3">
            {["max 500 rows per CSV", "max 1 MB", "UTF-8", "comma or semicolon"].map((f) => (
              <span key={f} className="font-mono text-xs bg-bg rounded-md px-2 py-1">{f}</span>
            ))}
          </div>
          <h3 className="text-xs font-mono text-muted mb-2">Columns, in this order</h3>
          <pre className="bg-bg rounded-lg p-3 text-xs font-mono whitespace-pre-wrap break-all">
            {"title,repo,risk_rating,observation,recommendation,verified,team\n\"Short title\",Vendor_Guard,High,\"...\",\"...\",yes,Team"}
          </pre>
          <p className="text-xs text-muted leading-relaxed mt-2">
            <code className="font-mono">repo</code> is the SAAF-Project repository name or the site.{" "}
            <code className="font-mono">risk_rating</code> is Critical, High, Medium, Low or Informational.{" "}
            <code className="font-mono">verified</code> is yes or no.
          </p>
        </section>

        <section className="bg-surface border border-border rounded-2xl p-5 min-w-0">
          <h2 className="text-xs font-mono text-muted mb-3">What counts as one finding</h2>
          <Rows rows={counts} />
          <p className="text-xs text-muted leading-relaxed mt-3">
            Tip for your agent: <i>&ldquo;Export our findings as CSV with exactly these columns, one row per distinct weakness, no secret values.&rdquo;</i>
          </p>
        </section>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="min-w-0">
          <h2 className="text-xs font-mono text-muted mb-3">The afternoon</h2>
          <dl className="border-t border-border">
            {afternoon.map((r) => (
              <div key={r.t} className="grid grid-cols-[88px_1fr] gap-3 py-2 border-b border-border text-sm">
                <dt className={`font-mono ${r.accent ? "text-accent" : ""}`}>{r.t}</dt>
                <dd className="text-muted leading-relaxed">{r.v}</dd>
              </div>
            ))}
          </dl>
          <p className="text-xs text-muted leading-relaxed mt-3">
            <span className="font-medium text-text">Judged on:</span> does it stop a real finding from today, can another SAAF
            repo reuse it, is it named and documented (README, how to run, limitations).
          </p>
        </section>

        <section className="bg-surface border border-border rounded-2xl p-5 min-w-0">
          <h2 className="text-xs font-mono text-muted mb-3">The quiz</h2>
          <p className="text-lg font-medium mb-2">Guess the total at 17:00.</p>
          <p className="text-sm text-muted leading-relaxed mb-4">
            127 findings before today, plus every new one the teams hand in. One guess each, change it until 17:00.
            Closest guess wins.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/quiz" className="text-sm px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium">
              Make your guess
            </Link>
            <Link href="/demo" className="text-sm px-4 py-2 rounded-lg border border-border hover:border-accent">
              Sign up for a demo
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
