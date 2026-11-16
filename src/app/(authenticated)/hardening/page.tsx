import Link from "next/link";
import AccessRequest from "@/components/AccessRequest";
import StandardsChecklist from "@/components/temple/standards/StandardsChecklist";
import ExternalReferences, { type ExternalReference } from "@/components/ExternalReferences";

// The hardening day handout (Session 11, 17 November 2026) as a page. The nine standards come from
// src/components/temple/standards/standards.ts, the same list the board at /standards checks.

// The printable handout. Set this to "/hardening/saaf-hardening-day-handout.pdf" once that file is in public/hardening/;
// until then the page shows no download button. Keep the text below in step with the PDF.
const HANDOUT_PDF: string | null = "/hardening/saaf-hardening-day-handout.pdf";

const routes = [
  { name: "Harden", text: "Take an existing agent and add what is missing from the nine." },
  { name: "Build", text: "Start an open plan from the starter template, with all nine built in." },
  { name: "Merge or revive", text: "Fold duplicate repos into one: the builders of both decide which one stays. Or revive a quiet agent and become its owner." },
];

const layers = [
  { k: "Always on", v: "Secret scanning with push protection, Dependabot, private vulnerability reporting." },
  { k: "Every pull request", v: "The standards check and a guard from Session 10 run in the pipeline." },
  { k: "Every quarter", v: "The owner takes the agent or service through the car wash again." },
];

const tile = [
  {
    k: "1",
    v: (
      <>
        Run the <code className="font-mono text-xs">harden-agent-repo</code> skill in your repo.{" "}
        <Link href="/open-source" className="text-accent hover:underline">Open-Source Readiness</Link> shows how.
      </>
    ),
  },
  { k: "2", v: "Open a pull request." },
  {
    k: "3",
    v: (
      <>
        After a maintainer merges it to the default branch (for example main or master), the board at{" "}
        <Link href="/standards" className="text-accent hover:underline">/standards</Link> marks the standard as met within two minutes, and it glows for the rest of the day.
      </>
    ),
  },
];

const day = [
  { t: "09:00", v: "Welcome and the assignment" },
  { t: "09:30", v: "Adriaan Heijstek, BDO" },
  { t: "10:05", v: "Sjoerd de Vries, BDO" },
  { t: "11:00", v: "Faissal Assakkach, BDO" },
  { t: "11:45", v: "Orq.ai workshop, Bauke Brenninkmeijer" },
  { t: "12:15", v: "Start hacking, then lunch" },
  { t: "15:15", v: "The leaderboard freezes" },
  { t: "16:00", v: "Last pull request opened; demo sign-up closes" },
  { t: "16:15", v: "Last merge, final review", accent: true },
  { t: "16:30", v: "Six demos of five minutes: lessons learned and better standards" },
  { t: "17:00", v: "The reveal and the prizes" },
  { t: "17:10", v: "Drinks" },
];

// Tools our guests brought. Each one is an external site: the list shows a notice before it opens.
const references: ExternalReference[] = [
  {
    name: "Orq.ai onboarding",
    url: "https://saaf-project.orq.ai",
    text: "Get your own project in the shared SAAF workspace on Orq.ai. The passcode is shared in the room.",
  },
  {
    name: "Orq.ai guide",
    url: "https://saaf-project.orq.ai/guide",
    text: "Send traces from your agent to see what it does, use the framework integrations, and red team your agent.",
  },
  {
    name: "evaluatorq",
    url: "https://github.com/orq-ai/evaluatorq",
    text: "The open-source package by Orq.ai for red teaming an agent.",
  },
  {
    name: "Is It Dead Yet",
    url: "https://isitdeadyet.dev/",
    text: "Dependency health: which packages are abandoned or carry advisories. Built by Ellert van der Vecht.",
  },
];

function Rows({ rows, mono = false }: { rows: { k: string; v: React.ReactNode }[]; mono?: boolean }) {
  return (
    <dl className="border-t border-border">
      {rows.map((r) => (
        <div key={r.k} className={`grid ${mono ? "grid-cols-[28px_1fr]" : "grid-cols-[112px_1fr]"} gap-3 py-2 border-b border-border text-sm`}>
          <dt className={mono ? "font-mono text-muted" : "font-medium"}>{r.k}</dt>
          <dd className="text-muted leading-relaxed">{r.v}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function HardeningPage() {
  return (
    <div className="max-w-[880px] mx-auto py-8">
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
        Take one agent through <span className="text-accent">the car wash.</span>
      </h1>
      <p className="text-muted leading-relaxed mb-8 max-w-[680px]">
        Every agent and every shared service goes through the same nine standards. Pick one route with your team. Every
        route ends in a merged pull request.
      </p>

      <div className="grid gap-6 sm:grid-cols-3 mb-10">
        {routes.map((r) => (
          <div key={r.name} className="border-t border-border pt-3">
            <div className="font-medium mb-1">{r.name}</div>
            <p className="text-sm text-muted leading-relaxed">{r.text}</p>
          </div>
        ))}
      </div>

      <AccessRequest />

      <section className="mb-10">
        <h2 className="text-lg font-medium mb-3">The nine standards.</h2>
        <StandardsChecklist />
      </section>

      <div className="grid gap-x-6 gap-y-10 md:grid-cols-2 mb-10">
        <section className="min-w-0">
          <h2 className="text-lg font-medium mb-3">Three layers keep it that way.</h2>
          <Rows rows={layers} />
          <p className="text-xs text-muted leading-relaxed mt-3">Proposed by Tony Barratt in his security review.</p>
        </section>

        <section className="min-w-0">
          <h2 className="text-lg font-medium mb-3">How a standard gets on the board.</h2>
          <Rows rows={tile} mono />
          <p className="text-xs text-muted leading-relaxed mt-3">The board reads the default branch only.</p>
        </section>
      </div>

      <section className="mb-10">
        <h2 className="text-lg font-medium mb-3">Tools from our guests.</h2>
        <p className="text-sm text-muted leading-relaxed mb-3">Select a tool to open it. Each one is an external site.</p>
        <ExternalReferences references={references} />
        <p className="text-xs text-muted leading-relaxed mt-3">
          Keep keys in environment variables, never in your repository. Use synthetic data when you try a tool.
        </p>
      </section>

      <section className="max-w-[560px]">
        <h2 className="text-lg font-medium mb-3">The day.</h2>
        <dl className="border-t border-border">
          {day.map((r) => (
            <div key={r.t} className="grid grid-cols-[88px_1fr] gap-3 py-2 border-b border-border text-sm">
              <dt className={`font-mono ${r.accent ? "text-accent" : ""}`}>{r.t}</dt>
              <dd className="text-muted leading-relaxed">{r.v}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-6">
          <Link href="/standards" className="inline-block text-sm px-4 py-2 rounded-lg border border-border hover:border-accent">
            Open the standards board
          </Link>
        </div>
      </section>
    </div>
  );
}
