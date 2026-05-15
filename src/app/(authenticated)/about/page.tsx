import Link from "next/link";

const PILLARS = [
  {
    icon: "💬",
    title: "Prompts",
    desc: "Domain-specific audit prompts and system instructions for AI agents.",
    color: "text-accent border-accent/30 bg-accent/8",
  },
  {
    icon: "🛠️",
    title: "Tools",
    desc: "Scripts, APIs, and integrations powering agent capabilities.",
    color: "text-saaf-green border-saaf-green/30 bg-saaf-green/8",
  },
  {
    icon: "📋",
    title: "Regulatory",
    desc: "Control mappings, guardrails, and AI usage policies.",
    color: "text-saaf-purple border-saaf-purple/30 bg-saaf-purple/8",
  },
  {
    icon: "📊",
    title: "Outputs",
    desc: "Standardised report formats — finding schema, audit reports, dashboards.",
    color: "text-saaf-yellow border-saaf-yellow/30 bg-saaf-yellow/8",
  },
];

const TIMELINE = [
  { label: "Alignment", desc: "Define umbrella frameworks and 4-pillar structure", date: "Pre-2026" },
  { label: "Hackathon 2", desc: "Initial agents — evidence, compliance, vendor risk", date: "Mar 2026" },
  { label: "Hackathon 3", desc: "Shared infrastructure (RAG, Strapi, MCP) + multi-agent patterns", date: "Apr 2026" },
  { label: "Hackathon 4", desc: "Build on H3 infrastructure — ongoing", date: "May 2026" },
];

const STATS = [
  { value: "45+", label: "organisations" },
  { value: "76", label: "participants" },
  { value: "74", label: "plans" },
  { value: "20+", label: "agent repos" },
];

export default function AboutPage() {
  return (
    <div className="max-w-4xl mx-auto">
      {/* Hero */}
      <div className="text-center mb-10">
        <h1 className="text-4xl font-extrabold mb-3">
          <span className="bg-gradient-to-r from-accent to-saaf-purple bg-clip-text text-transparent">
            What is SAAF?
          </span>
        </h1>
        <p className="text-lg text-muted max-w-2xl mx-auto leading-relaxed">
          The <strong className="text-text">Shared Audit Agents Framework</strong> brings 45+ organisations
          together to co-create AI agents for internal & IT audit — a vendor-agnostic, open-source initiative.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-10">
        {STATS.map((s) => (
          <div key={s.label} className="bg-surface border border-border rounded-xl p-4 text-center">
            <div className="text-2xl font-black bg-gradient-to-r from-accent to-saaf-purple bg-clip-text text-transparent">
              {s.value}
            </div>
            <div className="text-xs text-muted mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* 4 Pillars */}
      <h2 className="text-xl font-extrabold mb-4">The 4 Pillars</h2>
      <div className="grid md:grid-cols-2 gap-4 mb-10">
        {PILLARS.map((p) => (
          <div key={p.title} className={`border rounded-2xl p-5 ${p.color}`}>
            <div className="text-3xl mb-2">{p.icon}</div>
            <h3 className="text-lg font-bold mb-1">{p.title}</h3>
            <p className="text-sm opacity-90 leading-relaxed">{p.desc}</p>
          </div>
        ))}
      </div>

      {/* Timeline */}
      <h2 className="text-xl font-extrabold mb-4">Hackathon Timeline</h2>
      <div className="bg-surface border border-border rounded-2xl p-5 mb-10">
        <div className="space-y-4">
          {TIMELINE.map((t, i) => (
            <div key={t.label} className="flex gap-4">
              <div className="shrink-0 flex flex-col items-center">
                <div className="w-3 h-3 rounded-full bg-accent" />
                {i < TIMELINE.length - 1 && <div className="w-0.5 flex-1 bg-border mt-1" />}
              </div>
              <div className="pb-2">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-bold text-sm">{t.label}</span>
                  <span className="text-xs text-muted">· {t.date}</span>
                </div>
                <p className="text-sm text-muted">{t.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* How to contribute */}
      <h2 className="text-xl font-extrabold mb-4">How to contribute</h2>
      <div className="bg-surface border border-border rounded-2xl p-5 mb-10">
        <ol className="space-y-3 list-decimal pl-5 text-sm text-muted">
          <li>
            <strong className="text-text">Complete your profile</strong> — fill in your organisation,
            role, track and skills so the portal can match you to relevant work.
          </li>
          <li>
            <strong className="text-text">Browse plans</strong> — explore the Tracks page, find a plan
            that interests you, and read it.
          </li>
          <li>
            <strong className="text-text">Submit observability checks</strong> — for each plan you study,
            answer the 10-question observability framework. This is how we collectively audit the agents.
          </li>
          <li>
            <strong className="text-text">Claim a plan</strong> — when you commit to implementing a plan
            at your organisation, set yourself as the owner.
          </li>
          <li>
            <strong className="text-text">Open PRs</strong> — propose new plans, update existing ones,
            or contribute code to one of the 20+ agent repos in the SAAF-Project organisation.
          </li>
        </ol>
        <div className="mt-5 flex gap-2 flex-wrap">
          <Link
            href="/onboarding"
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg no-underline"
          >
            Step-by-step onboarding →
          </Link>
          <Link
            href="/tracks"
            className="px-4 py-2 border border-border bg-white/5 hover:bg-white/10 text-text text-sm font-semibold rounded-lg no-underline"
          >
            Explore tracks →
          </Link>
        </div>
      </div>

      {/* Mission */}
      <div className="bg-gradient-to-br from-accent/10 to-saaf-purple/5 border border-accent/20 rounded-2xl p-6 mb-10">
        <h3 className="font-bold mb-2">Our mission</h3>
        <p className="text-sm text-muted leading-relaxed">
          To make AI audit agents safer, more transparent, and more useful by building them
          openly together. Every agent gets red-teamed, observed, and audited before it
          touches production work — that&apos;s the SAAF way.
        </p>
      </div>
    </div>
  );
}
