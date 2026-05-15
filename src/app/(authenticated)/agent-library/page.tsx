"use client";

import { useEffect, useState } from "react";
import ComingSoonBanner from "@/components/ComingSoonBanner";
import type { AgentRepo } from "@/lib/github";

const LANGUAGE_COLORS: Record<string, string> = {
  Python: "bg-saaf-yellow/15 text-saaf-yellow",
  TypeScript: "bg-accent/15 text-accent",
  JavaScript: "bg-saaf-yellow/15 text-saaf-yellow",
  HTML: "bg-saaf-orange/15 text-saaf-orange",
};

export default function AgentLibraryPage() {
  const [agents, setAgents] = useState<AgentRepo[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    fetch("/api/agent-library")
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setAgents(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const categories = [...new Set(agents.map((a) => a.category))].sort();
  const filtered = filter ? agents.filter((a) => a.category === filter) : agents;

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-extrabold mb-2">Agent Library</h1>
      <p className="text-muted text-sm mb-6">
        Curated AI audit agents built by the SAAF community. Each agent has been manually reviewed
        before being added here. Browse and learn from real implementations.
      </p>

      {/* Disclaimer */}
      <div className="mb-6 p-4 bg-saaf-yellow/5 border border-saaf-yellow/20 rounded-xl text-xs text-muted leading-relaxed">
        <p className="text-saaf-yellow font-semibold mb-1">⚠ No assurance provided</p>
        <p>
          We cannot provide assurance on the AI agents in this library — AI LLMs can hallucinate
          and we have not yet completed the red-teaming (hack the agents) phase. Agents are shared
          as-is for research and collaboration purposes only. Use them in your own audit work at
          your own risk and always validate the output.
        </p>
      </div>

      {loading ? (
        <div className="text-muted text-center py-12">Loading agents...</div>
      ) : agents.length === 0 ? (
        <>
          <ComingSoonBanner
            title="Agent Library coming soon"
            description="The community is building dozens of agents in the SAAF-Project organisation. We're manually reviewing each one before adding it here. Check back soon."
          />
          <div className="mt-6 p-4 bg-accent/5 border border-accent/20 rounded-xl text-sm text-muted">
            <p>
              <strong className="text-text">Built an agent?</strong> Once your repo has a clear
              README and the agent is ready to share, ask Mathijs to add it to the library
              (use the Feedback button bottom-right).
            </p>
          </div>
        </>
      ) : (
        <>
          {/* Filters */}
          {categories.length > 1 && (
            <div className="flex gap-2 flex-wrap mb-5">
              <button
                onClick={() => setFilter("")}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg cursor-pointer transition-colors ${
                  filter === "" ? "bg-accent text-bg" : "bg-surface border border-border text-muted hover:text-text"
                }`}
              >
                All ({agents.length})
              </button>
              {categories.map((cat) => {
                const count = agents.filter((a) => a.category === cat).length;
                return (
                  <button
                    key={cat}
                    onClick={() => setFilter(cat)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg cursor-pointer transition-colors ${
                      filter === cat ? "bg-accent text-bg" : "bg-surface border border-border text-muted hover:text-text"
                    }`}
                  >
                    {cat} ({count})
                  </button>
                );
              })}
            </div>
          )}

          {/* Agents grid */}
          <div className="grid md:grid-cols-2 gap-4">
            {filtered.map((agent) => (
              <a
                key={agent.name}
                href={agent.htmlUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block bg-surface border border-border rounded-xl p-5 hover:border-accent/40 transition-all no-underline group"
              >
                <div className="flex items-start gap-2 mb-2 flex-wrap">
                  <h3 className="text-base font-bold group-hover:text-accent transition-colors flex-1 min-w-0 break-words">
                    {agent.name}
                  </h3>
                  {agent.isPrivate && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted/15 text-muted font-semibold shrink-0">
                      Private
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold bg-saaf-purple/15 text-saaf-purple">
                    {agent.category}
                  </span>
                  {agent.language && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${LANGUAGE_COLORS[agent.language] || "bg-muted/15 text-muted"}`}>
                      {agent.language}
                    </span>
                  )}
                  {agent.tags.map((tag) => (
                    <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-accent/10 text-accent">
                      {tag}
                    </span>
                  ))}
                </div>

                {agent.description && (
                  <p className="text-sm text-text leading-relaxed mb-2 font-medium">
                    {agent.description}
                  </p>
                )}

                {agent.readmeExcerpt && (
                  <p className="text-xs text-muted leading-relaxed mb-3 line-clamp-3">
                    {agent.readmeExcerpt}
                  </p>
                )}

                <div className="flex items-center gap-3 text-[11px] text-muted mt-3 pt-3 border-t border-border">
                  <span>Updated {new Date(agent.pushedAt).toLocaleDateString()}</span>
                  {agent.stars > 0 && <span>★ {agent.stars}</span>}
                  <span className="ml-auto text-accent">View on GitHub ↗</span>
                </div>
              </a>
            ))}
          </div>
        </>
      )}

      {/* Maintainer note */}
      <div className="mt-8 p-4 bg-accent/5 border border-accent/20 rounded-xl text-xs text-muted leading-relaxed">
        <p className="text-accent font-semibold mb-1">For maintainers</p>
        <p>
          To add an agent to this library, edit <code className="bg-surface2 px-1.5 py-0.5 rounded text-text">AGENT_LIBRARY_ALLOWLIST</code>{" "}
          in <code className="bg-surface2 px-1.5 py-0.5 rounded text-text">src/lib/github.ts</code>{" "}
          with the repo name, category, and optional tags. The portal fetches the README and
          metadata automatically.
        </p>
      </div>
    </div>
  );
}
