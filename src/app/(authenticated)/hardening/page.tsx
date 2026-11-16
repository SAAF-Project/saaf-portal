import Link from "next/link";
import AccessRequest from "@/components/AccessRequest";
import CopyPrompt from "@/components/CopyPrompt";
import ExternalReferences, { type ExternalReference } from "@/components/ExternalReferences";
import StandardsChecklist from "@/components/temple/standards/StandardsChecklist";
import { DATA_RULE, DAY_TRACKS, DEMO_LINE, PRIZE_LINE, SHORT_RULES, TRACKS_SUB } from "@/lib/day-tracks";

// The hardening day (Session 11, 17 November 2026) on one screen: pick one of three tracks, start it with one copied
// prompt, and see how you win. The tracks come from src/lib/day-tracks.ts, the nine standards from
// src/components/temple/standards/standards.ts (the same list the board at /standards checks). Everything else is
// folded away. Keep the text in step with the handout PDF.

const HANDOUT_PDF: string | null = "/hardening/saaf-hardening-day-handout.pdf";

const day = [
  { t: "09:00", v: "Welcome: Eduward van de Kamp on quality, Mathijs Schouten on the nine standards" },
  { t: "09:30", v: "Guests from BDO: Adriaan Heijstek, Faissal Assakkach (10:00), Sjoerd de Vries and Thijs Modderman (11:00). Coffee at 10:45" },
  { t: "11:45", v: "Bauke Brenninkmeijer, Orq.ai: observe and evaluate your agents" },
  { t: "12:15", v: "The assignment: three tracks. Lunch at 12:30, then build. In the afternoon: Gülnur Orpak, ABN AMRO, a 15-minute talk" },
  { t: "15:15", v: "The leaderboard freezes" },
  { t: "16:00", v: "Last pull request opened; demo sign-up closes" },
  { t: "16:15", v: "Last merge, final review", accent: true },
  { t: "16:30", v: "Six demos, two per track. The reveal at 17:00, drinks at 17:10" },
];

const layers = [
  { k: "Always on", v: "Secret scanning with push protection, Dependabot, private vulnerability reporting." },
  { k: "Every pull request", v: "The standards check and a guard from Session 10 run in the pipeline." },
  { k: "Every quarter", v: "The owner takes the agent or service through the nine standards again." },
];

// Tools our guests brought. Each one is an external site: the list shows a notice before it opens.
const references: ExternalReference[] = [
  {
    name: "Orq.ai onboarding",
    url: "https://saaf-project.orq.ai",
    text: "Get your own project in the shared SAAF workspace on Orq.ai. Get started copies one prompt that installs the two skills. The passcode is shared in the room.",
  },
  {
    name: "Orq.ai guide",
    url: "https://saaf-project.orq.ai/guide",
    text: "Trace what your agent does and score its runs against your own audit criteria, with the skills /orq-otel-tracing and /orq-criteria-to-evals.",
  },
  {
    name: "evaluatorq",
    url: "https://github.com/orq-ai/evaluatorq",
    text: "The open-source package by Orq.ai for running checks on test cases you choose.",
  },
  {
    name: "Is It Dead Yet",
    url: "https://isitdeadyet.dev/",
    text: "Dependency health: which packages are abandoned or carry advisories. Built by Ellert van der Vecht.",
  },
];

function Fold({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details className="group border-t border-border">
      <summary className="cursor-pointer list-none py-3 flex items-baseline justify-between gap-4">
        <span className="text-base font-medium">{title}</span>
        <span className="font-mono text-xs text-muted group-open:hidden">show</span>
        <span className="font-mono text-xs text-muted hidden group-open:inline">hide</span>
      </summary>
      <div className="pb-6">{children}</div>
    </details>
  );
}

export default function HardeningPage() {
  return (
    <div className="max-w-[1040px] mx-auto py-8">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/saaf-lockup-ink.png" alt="SAAF, Shared Audit Agents Framework" className="h-6 w-auto dark:invert" />
        {HANDOUT_PDF && (
          <a href={HANDOUT_PDF} download className="text-sm px-4 py-2 rounded-lg border border-border hover:border-accent">
            Download the handout (PDF)
          </a>
        )}
      </div>

      <p className="text-xs font-mono text-muted mb-1">Session #11 · Hackathon #10 · 17 November 2026 · TAG, The Stack, Amsterdam</p>
      <p className="text-xs font-mono text-muted mb-2">Sponsors of the day · BDO, title sponsor · TAG, venue and developer community</p>
      <h1 className="text-3xl font-medium leading-tight mb-3">
        Pick <span className="text-accent">one track.</span>
      </h1>
      <p className="text-muted leading-relaxed mb-8 max-w-[680px]">{TRACKS_SUB}</p>

      <ol className="grid gap-4 md:grid-cols-3 mb-6">
        {DAY_TRACKS.map((t) => (
          <li key={t.id} className="rounded-xl border border-border p-5 flex flex-col">
            <p className="font-mono text-xs text-muted mb-2">Track {t.number}</p>
            <h2 className="text-xl font-medium leading-tight mb-2">{t.name}</h2>
            <p className="text-sm text-muted leading-relaxed mb-4">{t.what}</p>
            <div className="mb-4">
              <CopyPrompt text={t.prompt} />
              {t.link && (
                <a href={t.link.href} target="_blank" rel="noopener noreferrer" className="inline-block mt-3 text-sm text-accent hover:underline">
                  {t.link.label} ↗
                </a>
              )}
            </div>
            <div className="mt-auto pt-4 border-t border-border">
              <p className="font-mono text-xs text-muted mb-1">How you win</p>
              <p className="text-sm leading-relaxed">{t.win}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="rounded-xl bg-surface2 px-5 py-4 mb-10 flex flex-wrap items-center justify-between gap-x-8 gap-y-3">
        <p className="text-sm leading-relaxed max-w-[560px]">
          {PRIZE_LINE} {DEMO_LINE}
        </p>
        <div className="flex flex-wrap gap-2">
          <Link href="/standards" className="text-sm px-4 py-2 rounded-lg border border-border bg-bg hover:border-accent">
            Open the board
          </Link>
          <Link href="/demo" className="text-sm px-4 py-2 rounded-lg border border-border bg-bg hover:border-accent">
            Sign up for a demo
          </Link>
        </div>
      </div>

      <div className="grid gap-x-10 gap-y-10 md:grid-cols-2 mb-10">
        <section className="min-w-0">
          <h2 className="text-lg font-medium mb-3">Five rules.</h2>
          <ol className="border-t border-border">
            {SHORT_RULES.map((r, i) => (
              <li key={i} className="grid grid-cols-[1.5rem_1fr] gap-x-3 py-2 border-b border-border text-sm text-muted leading-relaxed">
                <span className="font-mono text-xs pt-0.5">{i + 1}</span>
                <span>{r}</span>
              </li>
            ))}
          </ol>
          <p className="text-sm text-muted leading-relaxed mt-3">{DATA_RULE}</p>
          <p className="text-xs text-muted leading-relaxed mt-2">
            All rules are on the <Link href="/standards#rules" className="text-accent hover:underline">board</Link>.
          </p>
        </section>

        <section className="min-w-0">
          <h2 className="text-lg font-medium mb-3">The day.</h2>
          <dl className="border-t border-border">
            {day.map((r) => (
              <div key={r.t} className="grid grid-cols-[64px_1fr] gap-3 py-2 border-b border-border text-sm">
                <dt className={`font-mono ${r.accent ? "text-accent" : ""}`}>{r.t}</dt>
                <dd className="text-muted leading-relaxed">{r.v}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>

      <div className="border-b border-border">
        <Fold title="The nine standards.">
          <StandardsChecklist />
          <p className="text-sm text-muted leading-relaxed mt-4 max-w-[720px]">
            A standard counts once a pull request is merged into the default branch (for example main or master). The board at{" "}
            <Link href="/standards" className="text-accent hover:underline">/standards</Link> marks it as met within two minutes, and it glows for the rest
            of the day. The <code className="font-mono text-xs">harden-agent-repo</code> skill walks through all nine;{" "}
            <Link href="/open-source" className="text-accent hover:underline">Open-Source Readiness</Link> shows how to install it for good.
          </p>
          <h3 className="text-sm font-medium mt-6 mb-2">Three layers keep it that way.</h3>
          <dl className="border-t border-border max-w-[720px]">
            {layers.map((r) => (
              <div key={r.k} className="grid grid-cols-[150px_1fr] gap-3 py-2 border-b border-border text-sm">
                <dt className="font-medium">{r.k}</dt>
                <dd className="text-muted leading-relaxed">{r.v}</dd>
              </div>
            ))}
          </dl>
          <p className="text-xs text-muted leading-relaxed mt-2">Proposed by Tony Barratt in his security review.</p>
        </Fold>
        <Fold title="Work on a repo that is not yours.">
          <AccessRequest />
        </Fold>
        <Fold title="Tools from our guests.">
          <p className="text-sm text-muted leading-relaxed mb-3">Select a tool to open it. Each one is an external site.</p>
          <ExternalReferences references={references} />
          <p className="text-xs text-muted leading-relaxed mt-3">Keep keys in environment variables, never in your repository. Use synthetic data when you try a tool.</p>
        </Fold>
      </div>
    </div>
  );
}
