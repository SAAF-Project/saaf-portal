import ComingSoonBanner from "@/components/ComingSoonBanner";

const ANTHROPIC_COURSES = [
  { title: "Claude 101", desc: "Use Claude for everyday work tasks — core features and resources for advanced learning.", audience: "All" },
  { title: "Claude Code 101", desc: "Use Claude Code effectively in your daily development workflow.", audience: "Engineers" },
  { title: "Introduction to Claude Cowork", desc: "Hands-on course on task loops, plugins, skills, file workflows, multi-step work.", audience: "Engineers" },
  { title: "Claude Code in Action", desc: "Integrate Claude Code into your development workflow.", audience: "Engineers" },
  { title: "AI Fluency: Framework & Foundations", desc: "Collaborate with AI systems effectively, efficiently, ethically, and safely.", audience: "All" },
  { title: "Building with the Claude API", desc: "Work with Anthropic models programmatically using the Claude API.", audience: "Engineers" },
  { title: "Introduction to Model Context Protocol (MCP)", desc: "Build MCP servers and clients — tools, resources, and prompts.", audience: "Engineers" },
  { title: "Introduction to Agent Skills", desc: "Build, configure, and share reusable markdown instructions for Claude Code.", audience: "Engineers" },
  { title: "Introduction to Subagents", desc: "Use and create sub-agents to manage context and delegate specialised tasks.", audience: "Engineers" },
  { title: "Model Context Protocol: Advanced Topics", desc: "Advanced MCP patterns: sampling, notifications, production development.", audience: "Engineers (advanced)" },
  { title: "AI Capabilities and Limitations", desc: "Introductory course on how AI works.", audience: "All" },
  { title: "Claude with Amazon Bedrock", desc: "Working with Claude through AWS Bedrock.", audience: "AWS users" },
  { title: "Claude with Google Cloud Vertex AI", desc: "Working with Anthropic models through Google Cloud Vertex AI.", audience: "GCP users" },
  { title: "AI Fluency for Educators / Students / Nonprofits / Small Businesses", desc: "Sector-specific AI fluency tracks for different audiences.", audience: "Various" },
];

const CCFE_MODULES = [
  { title: "Module 0: Getting Started", desc: "Orientation: Claude Code basics, installation, and initial project setup.", duration: "~30 min" },
  { title: "Module 1: Fundamentals", desc: "Core skills: file operations, visual workspace, parallel agent launching, sub-agents, project memory (CLAUDE.md), power-user commands.", duration: "~3 hours" },
  { title: "Module 2: Vibe Coding", desc: "App development with Claude Code: planning interviews, scaffolded apps, screenshot iteration, GitHub version control, Vercel deployment.", duration: "~1-2 hours" },
  { title: "Mini Lessons", desc: "Specialised workflows: Ross Mike techniques, advanced approaches, Vin Obsidian integrations.", duration: "Varies" },
];

export default function ELearningPage() {
  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-extrabold mb-2">E-Learning</h1>
      <p className="text-muted text-sm mb-8">
        SAAF doesn&apos;t have its own learning platform yet — but here are external resources we
        recommend to build the AI fluency you need to contribute effectively.
      </p>

      {/* SAAF in-portal coming soon */}
      <div className="mb-8">
        <ComingSoonBanner
          title="SAAF Learning Modules"
          description="Interactive learning modules tailored to AI audit agent development — coming to this portal in a future hackathon. Build your skills in prompts, tools, regulatory frameworks, and output quality."
        />
      </div>

      {/* External resources header */}
      <div className="mb-4 flex items-center gap-2 flex-wrap">
        <h2 className="text-xl font-extrabold">External resources</h2>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-saaf-yellow/15 text-saaf-yellow font-bold uppercase tracking-wider">
          External
        </span>
      </div>
      <p className="text-muted text-sm mb-6">
        These resources are <strong className="text-text">not built or maintained by SAAF</strong>.
        They&apos;re run by Anthropic and the wider Claude community. We link them here because
        they&apos;re the best foundational training we know of for the tools many SAAF participants use.
      </p>

      {/* Anthropic Skilljar */}
      <div className="bg-surface border border-border rounded-2xl p-6 mb-6">
        <div className="flex items-start gap-3 mb-3">
          <span className="text-3xl shrink-0">🎓</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-lg font-bold">Anthropic Academy</h3>
              <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold bg-saaf-yellow/15 text-saaf-yellow">
                External · Free
              </span>
            </div>
            <p className="text-muted text-sm mt-1">
              Anthropic&apos;s official course library. Wide range — from beginner Claude usage to
              advanced API and MCP development.
            </p>
            <a
              href="https://anthropic.skilljar.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 mt-2 text-sm text-accent font-semibold hover:underline"
            >
              anthropic.skilljar.com ↗
            </a>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-border">
          <h4 className="text-xs font-bold text-muted uppercase tracking-wider mb-3">
            Available courses ({ANTHROPIC_COURSES.length})
          </h4>
          <div className="space-y-2">
            {ANTHROPIC_COURSES.map((c) => (
              <div key={c.title} className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-white/3 transition-colors">
                <span className="text-saaf-green text-xs mt-1 shrink-0">✓</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="font-semibold text-sm">{c.title}</span>
                    <span className="text-[10px] text-muted">· {c.audience}</span>
                  </div>
                  <p className="text-xs text-muted mt-0.5">{c.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Claude Code for Everyone */}
      <div className="bg-surface border border-border rounded-2xl p-6 mb-6">
        <div className="flex items-start gap-3 mb-3">
          <span className="text-3xl shrink-0">💻</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-lg font-bold">Claude Code for Everyone</h3>
              <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold bg-saaf-yellow/15 text-saaf-yellow">
                External · Free*
              </span>
            </div>
            <p className="text-muted text-sm mt-1">
              Hands-on tutorial for non-technical users — learn Claude Code <em>inside</em> Claude Code.
              No coding or terminal experience required.
            </p>
            <a
              href="https://ccforeveryone.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 mt-2 text-sm text-accent font-semibold hover:underline"
            >
              ccforeveryone.com ↗
            </a>
            <p className="text-[11px] text-muted mt-2 italic">
              * Course material is free, but requires a Claude Pro or Max subscription
              (~$20/month) to follow along.
            </p>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-border">
          <h4 className="text-xs font-bold text-muted uppercase tracking-wider mb-3">
            Modules
          </h4>
          <div className="space-y-2">
            {CCFE_MODULES.map((m) => (
              <div key={m.title} className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-white/3 transition-colors">
                <span className="text-saaf-green text-xs mt-1 shrink-0">✓</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="font-semibold text-sm">{m.title}</span>
                    <span className="text-[10px] text-muted">· {m.duration}</span>
                  </div>
                  <p className="text-xs text-muted mt-0.5">{m.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="p-4 bg-saaf-yellow/5 border border-saaf-yellow/20 rounded-xl text-xs text-muted leading-relaxed">
        <p className="text-saaf-yellow font-semibold mb-1">Disclaimer</p>
        <p>
          External resources are linked for convenience. SAAF Project does not endorse, control, or
          guarantee the content, pricing, or availability of these third-party platforms. Course
          information was accurate at the time of writing — refer to the source sites for the latest
          curriculum and pricing.
        </p>
      </div>

      {/* Got a recommendation? */}
      <div className="mt-6 p-4 bg-accent/5 border border-accent/20 rounded-xl text-sm">
        <p className="text-muted">
          <strong className="text-text">Know a great learning resource?</strong> Use the Feedback button
          (bottom-right) to suggest it — we&apos;ll review and add it here.
        </p>
      </div>
    </div>
  );
}
