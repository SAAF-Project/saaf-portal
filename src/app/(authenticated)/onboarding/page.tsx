import Link from "next/link";

const CONTRIBUTION_WAYS = [
  {
    icon: "🔍",
    title: "Submit observability checks",
    needsGit: false,
    desc: "Read a plan and answer the 10-question observability framework. No Git needed — do it from this portal.",
    href: "/tracks",
    cta: "Go to Tracks",
    color: "border-saaf-green/30 bg-saaf-green/5",
    iconColor: "text-saaf-green",
  },
  {
    icon: "💬",
    title: "Give feedback",
    needsGit: false,
    desc: "Use the floating Feedback button (bottom-right) to share thoughts about the SAAF Project or this portal. Two clicks, fully in-portal.",
    color: "border-accent/30 bg-accent/5",
    iconColor: "text-accent",
  },
  {
    icon: "✋",
    title: "Claim a plan",
    needsGit: true,
    desc: "When you commit to implementing a plan at your organisation, claim it. This signals to the community that you're building it — preventing duplication.",
    href: "#claiming",
    cta: "Learn how →",
    color: "border-saaf-yellow/30 bg-saaf-yellow/5",
    iconColor: "text-saaf-yellow",
  },
  {
    icon: "✏️",
    title: "Update an existing plan",
    needsGit: true,
    desc: "Improve a plan: update PDCA status, add prompts, sharpen the problem statement. Open a PR with your changes.",
    color: "border-saaf-purple/30 bg-saaf-purple/5",
    iconColor: "text-saaf-purple",
  },
  {
    icon: "📝",
    title: "Write a new plan",
    needsGit: true,
    desc: "Got an idea for a new audit agent or workflow? Add a new plan file in plans/hackathon-X/ via PR.",
    href: "#new-plan",
    cta: "See workflow →",
    color: "border-accent/30 bg-accent/5",
    iconColor: "text-accent",
  },
  {
    icon: "🛠️",
    title: "Build an agent",
    needsGit: true,
    desc: "Implement an agent in code. Create a new repo in the SAAF-Project organisation, or contribute to an existing agent repo.",
    href: "https://github.com/orgs/SAAF-Project/repositories",
    external: true,
    cta: "Browse org repos ↗",
    color: "border-saaf-orange/30 bg-saaf-orange/5",
    iconColor: "text-saaf-orange",
  },
];

const OBSERVABILITY_QUESTIONS = [
  "Purpose — what does the agent do?",
  "Users & Stakeholders — who uses it, audits it, can be harmed?",
  "Workflow — step-by-step from input to output",
  "Critical decisions — where is risk concentrated?",
  "Failure modes — where could this go wrong?",
  "Observability fields — what must be captured to reconstruct later?",
  "Controls — tool allowlist, policy gates, human approvals",
  "Audit evidence — what must be available months later?",
  "Alerts & triggers — no citation, fast approval, behaviour shift?",
  "Success metrics — engineering, audit, business",
];

export default function OnboardingPage() {
  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-3xl font-extrabold mb-2">How to Contribute</h1>
      <p className="text-muted text-sm mb-8">
        SAAF is community-built. Here are all the ways you can contribute — from a 5-minute observability check to building a full agent.
      </p>

      {/* Do I need Git? */}
      <div className="bg-surface border border-border rounded-2xl p-6 mb-8">
        <h3 className="text-base font-bold text-accent mb-3">Do I need to know Git?</h3>
        <div className="grid md:grid-cols-2 gap-3">
          <div className="p-3 bg-saaf-green/5 border border-saaf-green/20 rounded-lg">
            <div className="font-semibold text-sm text-saaf-green mb-1">No Git needed</div>
            <p className="text-xs text-muted leading-relaxed">
              Observability checks, feedback, browsing plans, profile — all done in the portal.
              Most auditors start here.
            </p>
          </div>
          <div className="p-3 bg-accent/5 border border-accent/20 rounded-lg">
            <div className="font-semibold text-sm text-accent mb-1">Git needed</div>
            <p className="text-xs text-muted leading-relaxed">
              Claiming a plan, updating a plan, writing a new plan, building an agent — all
              involve a pull request to the SAAF repo.
            </p>
          </div>
        </div>
      </div>

      {/* Ways to contribute */}
      <h2 className="text-xl font-extrabold mb-3">Ways to contribute</h2>
      <div className="space-y-3 mb-12">
        {CONTRIBUTION_WAYS.map((way) => {
          const inner = (
            <div className={`flex gap-4 p-5 border rounded-2xl transition-all hover:scale-[1.01] cursor-pointer ${way.color}`}>
              <div className={`text-3xl shrink-0 ${way.iconColor}`}>{way.icon}</div>
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <h3 className="font-bold text-base">{way.title}</h3>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${way.needsGit ? "bg-accent/15 text-accent" : "bg-saaf-green/15 text-saaf-green"}`}>
                    {way.needsGit ? "Git required" : "No Git needed"}
                  </span>
                </div>
                <p className="text-sm text-muted leading-relaxed">{way.desc}</p>
                {way.cta && (
                  <span className={`inline-block mt-2 text-xs font-semibold ${way.iconColor}`}>
                    {way.cta}
                  </span>
                )}
              </div>
            </div>
          );
          if (way.external && way.href) {
            return (
              <a key={way.title} href={way.href} target="_blank" rel="noopener noreferrer" className="block no-underline">
                {inner}
              </a>
            );
          }
          if (way.href) {
            return (
              <Link key={way.title} href={way.href} className="block no-underline">
                {inner}
              </Link>
            );
          }
          return <div key={way.title}>{inner}</div>;
        })}
      </div>

      {/* Observability checks deep-dive */}
      <h2 id="observability" className="text-xl font-extrabold mb-3 flex items-center gap-2">
        <span className="text-saaf-green">🔍</span>
        About observability checks
      </h2>
      <div className="bg-surface border border-border rounded-2xl p-6 mb-8">
        <p className="text-sm text-muted leading-relaxed mb-4">
          An <strong className="text-text">observability check</strong> is the SAAF community&apos;s way
          of collectively auditing each AI agent before it goes into production work. Every plan in
          the portal can have observability checks from multiple participants.
        </p>
        <p className="text-sm text-muted leading-relaxed mb-4">
          When you submit a check, you answer 10 structured questions about the agent. Your answers
          appear under your name and others can read them. The 10 questions are:
        </p>
        <ol className="list-decimal pl-5 space-y-1.5 text-sm text-muted mb-4">
          {OBSERVABILITY_QUESTIONS.map((q) => (
            <li key={q}>{q}</li>
          ))}
        </ol>
        <p className="text-sm text-muted leading-relaxed mb-4">
          You don&apos;t need to fill in all 10 — even one solid answer helps. You can come back and
          edit your check anytime. <strong className="text-text">Submit checks for plans your
          organisation could realistically use</strong> — those are the ones where your insight
          matters most.
        </p>
        <div className="flex items-center gap-2 p-3 bg-saaf-yellow/5 border border-saaf-yellow/20 rounded-lg">
          <span className="text-saaf-yellow text-lg">🏆</span>
          <p className="text-xs text-muted">
            Each unique plan-check earns progress toward your{" "}
            <strong className="text-text">Observability Observer</strong> badge (Bronze at 1 check,
            Diamond at 36).
          </p>
        </div>
        <Link
          href="/tracks"
          className="inline-flex items-center gap-1 mt-4 text-sm text-accent font-semibold hover:underline"
        >
          Open Tracks to start submitting checks →
        </Link>
      </div>

      {/* Plan claiming deep-dive */}
      <h2 id="claiming" className="text-xl font-extrabold mb-3 flex items-center gap-2">
        <span className="text-saaf-yellow">✋</span>
        About claiming plans
      </h2>
      <div className="bg-surface border border-border rounded-2xl p-6 mb-8">
        <p className="text-sm text-muted leading-relaxed mb-4">
          A <strong className="text-text">claim</strong> signals to the community: &ldquo;I am
          implementing this plan at my organisation.&rdquo; Claiming is voluntary but valuable — it
          prevents two people building the same thing in parallel.
        </p>

        <h4 className="font-bold text-sm mb-2 mt-4">When to claim</h4>
        <ul className="list-disc pl-5 space-y-1 text-sm text-muted mb-4">
          <li>You have committed (or your organisation has) to building this agent in production</li>
          <li>You will share back lessons learned, code, or refinements</li>
          <li>You want others to coordinate with you instead of duplicating effort</li>
        </ul>

        <h4 className="font-bold text-sm mb-2">How to claim (Git workflow)</h4>
        <ol className="list-decimal pl-5 space-y-2 text-sm text-muted mb-4">
          <li>
            Open the plan&apos;s markdown file on GitHub (use the &ldquo;View on GitHub&rdquo; link in Tracks)
          </li>
          <li>
            Edit the metadata section at the top — find the <code className="bg-surface2 px-1.5 py-0.5 rounded text-xs text-text">Claimed By</code> field
          </li>
          <li>
            Set it to your name: <code className="bg-surface2 px-1.5 py-0.5 rounded text-xs text-text">| **Claimed By** | Mathijs Schouten |</code>
          </li>
          <li>
            Open a PR — when merged, your claim shows up on the plan&apos;s card in Tracks
          </li>
        </ol>

        <div className="flex items-center gap-2 p-3 bg-saaf-yellow/5 border border-saaf-yellow/20 rounded-lg">
          <span className="text-saaf-yellow text-lg">🏆</span>
          <p className="text-xs text-muted">
            Claiming earns you the <strong className="text-text">Implementer</strong> badge
            (Bronze at 1 claim, Gold at 2). Capped — claims are meant to be meaningful, not farmed.
          </p>
        </div>

        <p className="text-xs text-muted leading-relaxed mt-4 italic">
          Note: claiming is not the only way to use a plan. You can implement an agent without
          claiming — claiming is an explicit signal of commitment.
        </p>
      </div>

      {/* Git workflow */}
      <h2 id="new-plan" className="text-xl font-extrabold mb-3 flex items-center gap-2">
        <span className="text-accent">⚙</span>
        Git workflow — for any PR to the SAAF-Project repo
      </h2>
      <p className="text-muted text-sm mb-4">
        These steps apply to any contribution that needs a pull request to{" "}
        <code className="px-1.5 py-0.5 bg-surface2 rounded text-xs text-text">SAAF-Project/SAAF-Project</code>{" "}
        — claiming a plan, updating a plan, writing a new plan, or any other change to the repo
        (prompts, tools, regulatory mappings, output schemas, scripts). If you&apos;re stuck, ask
        Mathijs or Eduward, or open a GitHub Discussion.
      </p>

      {/* Visual flow */}
      <div className="flex items-center gap-0 mb-6 overflow-x-auto">
        {["Fork", "Branch", "Write", "Push", "PR"].map((step, i, arr) => (
          <div key={step} className="flex items-center">
            <div className="flex-1 text-center px-4 py-2.5 bg-surface border border-border text-xs font-semibold first:rounded-l-lg last:rounded-r-lg whitespace-nowrap">
              {step}
            </div>
            {i < arr.length - 1 && <span className="text-muted text-lg px-1">›</span>}
          </div>
        ))}
      </div>

      {/* Steps */}
      <div className="space-y-5 mb-8">
        {[
          {
            title: "Fork & clone the repository",
            desc: "Easiest with the gh CLI — creates your own copy and clones it locally in one step.",
            code: "gh repo fork SAAF-Project/SAAF-Project --clone\ncd SAAF-Project",
            note: (
              <>
                Don&apos;t have <code className="px-1.5 py-0.5 bg-surface2 rounded text-xs">gh</code>?{" "}
                <a href="https://cli.github.com" target="_blank" rel="noopener noreferrer">cli.github.com</a>{" "}
                — or use the Fork button on GitHub and clone manually.
              </>
            ),
          },
          {
            title: "Create a branch",
            desc: "Use your name and a short description. Lowercase with hyphens.",
            code: "git checkout -b your-name/plan-your-slug",
          },
          {
            title: "Make your changes",
            desc: "Whether it's a new plan, an update, or a claim — edit the relevant markdown file. Claude Code can help.",
            code: 'cp docs/plans/plan-template.md \\\n  plans/hackathon-4/firstname-lastname-slug.md',
            note: (
              <>
                Browse{" "}
                <a href="https://github.com/SAAF-Project/SAAF-Project/blob/main/plans/overview.md" target="_blank" rel="noopener noreferrer">
                  plans/overview.md
                </a>{" "}
                for inspiration — or pick a gap from{" "}
                <a href="https://github.com/SAAF-Project/SAAF-Project/blob/main/plans/gap-analysis.md" target="_blank" rel="noopener noreferrer">
                  gap-analysis.md
                </a>.
              </>
            ),
          },
          {
            title: "Update PDCA status",
            desc: "Section 11 of the plan template has a PDCA table. Mark each phase as you go: Not started → In progress → Complete.",
          },
          {
            title: "Commit, push & open a PR",
            code: 'git add plans/hackathon-4/firstname-lastname-slug.md\ngit commit -m "plan: firstname-lastname-slug"\ngit push origin your-name/plan-your-slug\ngh pr create --title "Plan: your slug" --base main',
            note: "Once merged, the plan appears in the portal automatically after data regeneration.",
          },
        ].map((step, i) => (
          <div key={i} className="flex gap-4">
            <div className="shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-accent to-saaf-purple flex items-center justify-center font-extrabold text-sm text-white">
              {i + 1}
            </div>
            <div className="flex-1">
              <h4 className="font-bold text-[15px] mb-1">{step.title}</h4>
              {step.desc && <p className="text-sm text-muted mb-2">{step.desc}</p>}
              {step.code && (
                <pre className="bg-surface2 rounded-lg p-3 text-xs text-text font-mono leading-relaxed overflow-x-auto mb-2">
                  {step.code}
                </pre>
              )}
              {step.note && <p className="text-xs text-muted mt-1">{step.note}</p>}
            </div>
          </div>
        ))}
      </div>

      {/* Final CTAs */}
      <div className="flex gap-3 flex-wrap mt-8">
        <Link
          href="/tracks"
          className="inline-block px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl no-underline"
        >
          Explore Tracks →
        </Link>
        <a
          href="https://github.com/SAAF-Project/SAAF-Project/blob/main/docs/getting-started.md"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block px-5 py-2.5 border border-white/10 bg-white/5 text-text text-sm font-medium rounded-xl no-underline hover:bg-white/10"
        >
          Full Guide on GitHub ↗
        </a>
        <a
          href="https://github.com/SAAF-Project/SAAF-Project/discussions"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block px-5 py-2.5 border border-white/10 bg-white/5 text-text text-sm font-medium rounded-xl no-underline hover:bg-white/10"
        >
          Ask in Discussions ↗
        </a>
      </div>
    </div>
  );
}
