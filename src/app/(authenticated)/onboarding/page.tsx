export default function OnboardingPage() {
  const steps = [
    {
      title: "Fork & clone the repository",
      desc: 'The easiest way is with the gh CLI (GitHub CLI). This creates your own copy and clones it locally in one step.',
      code: "gh repo fork SAAF-Project/SAAF-Project --clone\ncd SAAF-Project",
      note: (
        <>
          Don&apos;t have <code className="px-1.5 py-0.5 bg-surface2 rounded text-xs">gh</code>?{" "}
          <a href="https://cli.github.com" target="_blank" rel="noopener noreferrer">
            cli.github.com
          </a>{" "}
          — or use the Fork button on GitHub and clone manually.
        </>
      ),
    },
    {
      title: "Create a branch",
      desc: "Use your name and a short description. Keep it lowercase with hyphens.",
      code: "git checkout -b your-name/plan-your-slug",
    },
    {
      title: "Write your plan",
      desc: "Copy the template into the Hackathon #4 folder and fill it in. Claude Code can help — open the repo in Claude Code and ask it to help fill in each section.",
      code: 'cp docs/plans/plan-template.md \\\n  plans/hackathon-4/firstname-lastname-slug.md',
      note: (
        <>
          Not sure what to write? Browse{" "}
          <a
            href="https://github.com/SAAF-Project/SAAF-Project/blob/main/plans/overview.md"
            target="_blank"
            rel="noopener noreferrer"
          >
            plans/overview.md
          </a>{" "}
          for inspiration — or pick a gap from{" "}
          <a
            href="https://github.com/SAAF-Project/SAAF-Project/blob/main/plans/gap-analysis.md"
            target="_blank"
            rel="noopener noreferrer"
          >
            gap-analysis.md
          </a>
          .
        </>
      ),
    },
    {
      title: "Reference & claim other plans",
      desc: "Link to related plans using relative paths in your markdown. To claim a plan, add your name to the Claimed By field in Section 1.",
      code: 'See also: [RAG KB](../hackathon-3/saaf-rag-knowledge-base.md)',
    },
    {
      title: "Update the PDCA status",
      desc: 'Section 11 of the template has a PDCA table. Mark each phase as you go: Not started → In progress → Complete.',
    },
    {
      title: "Commit, push & open a Pull Request",
      desc: null,
      code: 'git add plans/hackathon-4/firstname-lastname-slug.md\ngit commit -m "plan: firstname-lastname-slug"\ngit push origin your-name/plan-your-slug\ngh pr create --title "Plan: your slug" --base main',
      note: "Once merged, your plan appears in the portal automatically after the data is regenerated.",
    },
  ];

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-extrabold mb-2">How to Contribute</h1>
      <p className="text-muted text-sm mb-8">
        How to contribute a plan to the SAAF repository
      </p>

      <div className="bg-surface border border-border rounded-2xl p-6 mb-6">
        <h3 className="text-base font-bold text-accent mb-2">Do I need Git?</h3>
        <p className="text-sm text-muted mb-2">
          <strong className="text-text">Just browsing?</strong> You can read all
          plans on GitHub without any local setup — click any plan card on the
          Tracks page.
        </p>
        <p className="text-sm text-muted">
          <strong className="text-text">Want to contribute a plan?</strong>{" "}
          Follow the six steps below. If you get stuck, ask Mathijs or Eduward —
          or open a GitHub Discussion.
        </p>
      </div>

      {/* Visual flow */}
      <div className="flex items-center gap-0 mb-8 overflow-x-auto">
        {["Fork", "Branch", "Write", "Push", "PR"].map((step, i, arr) => (
          <div key={step} className="flex items-center">
            <div className="flex-1 text-center px-4 py-2.5 bg-surface border border-border text-xs font-semibold first:rounded-l-lg last:rounded-r-lg">
              {step}
            </div>
            {i < arr.length - 1 && (
              <span className="text-muted text-lg px-1">›</span>
            )}
          </div>
        ))}
      </div>

      {/* Steps */}
      <div className="space-y-6">
        {steps.map((step, i) => (
          <div key={i} className="flex gap-4">
            <div className="shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-accent to-saaf-purple flex items-center justify-center font-extrabold text-sm text-white">
              {i + 1}
            </div>
            <div className="flex-1">
              <h4 className="font-bold text-[15px] mb-1">{step.title}</h4>
              {step.desc && (
                <p className="text-sm text-muted mb-2">{step.desc}</p>
              )}
              {step.code && (
                <pre className="bg-surface2 rounded-lg p-3 text-xs text-text font-mono leading-relaxed overflow-x-auto mb-2">
                  {step.code}
                </pre>
              )}
              {step.note && (
                <p className="text-xs text-muted mt-1">{step.note}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-3 flex-wrap mt-8">
        <a
          href="/tracks"
          className="inline-block px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl no-underline"
        >
          Explore Tracks →
        </a>
        <a
          href="https://github.com/SAAF-Project/SAAF-Project/blob/main/docs/getting-started.md"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block px-5 py-2.5 border border-white/10 bg-white/5 text-text text-sm font-medium rounded-xl no-underline hover:bg-white/10"
        >
          Full Guide on GitHub ↗
        </a>
      </div>
    </div>
  );
}
