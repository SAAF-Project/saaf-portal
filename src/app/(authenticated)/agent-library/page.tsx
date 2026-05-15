"use client";

import { useEffect, useState } from "react";
import type { AgentRepo, AgentStatus } from "@/lib/github";

const LANGUAGE_COLORS: Record<string, string> = {
  Python: "bg-saaf-yellow/15 text-saaf-yellow",
  TypeScript: "bg-accent/15 text-accent",
  JavaScript: "bg-saaf-yellow/15 text-saaf-yellow",
  HTML: "bg-saaf-orange/15 text-saaf-orange",
};

const STATUS_META: Record<AgentStatus, { label: string; color: string; description: string }> = {
  reviewed: {
    label: "✓ Reviewed",
    color: "bg-saaf-green/15 text-saaf-green border-saaf-green/30",
    description: "Manually reviewed for code quality, README, and structure.",
  },
  "not-reviewed": {
    label: "Not reviewed yet",
    color: "bg-muted/15 text-muted border-muted/30",
    description: "Has a README but hasn't been quality-reviewed yet.",
  },
  "work-in-progress": {
    label: "Work in progress",
    color: "bg-saaf-yellow/15 text-saaf-yellow border-saaf-yellow/30",
    description: "Repo exists but README is minimal — likely still being built.",
  },
  "needs-readme": {
    label: "Needs README",
    color: "bg-saaf-red/15 text-saaf-red border-saaf-red/30",
    description: "No README found. Hard to tell what this agent does.",
  },
};

function QualityCheck({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-semibold ${
        ok ? "bg-saaf-green/12 text-saaf-green" : "bg-border/50 text-muted line-through opacity-70"
      }`}
    >
      <span>{ok ? "✓" : "○"}</span>
      <span>{label}</span>
    </span>
  );
}

export default function AgentLibraryPage() {
  const [agents, setAgents] = useState<AgentRepo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<AgentStatus | "all">("all");

  useEffect(() => {
    fetch("/api/agent-library")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d)) setAgents(d);
        else if (d?.error) setError(String(d.error));
      })
      .catch(() => setError("Failed to load agents"))
      .finally(() => setLoading(false));
  }, []);

  const filtered = statusFilter === "all" ? agents : agents.filter((a) => a.status === statusFilter);
  const counts: Record<string, number> = {
    all: agents.length,
    reviewed: agents.filter((a) => a.status === "reviewed").length,
    "not-reviewed": agents.filter((a) => a.status === "not-reviewed").length,
    "work-in-progress": agents.filter((a) => a.status === "work-in-progress").length,
    "needs-readme": agents.filter((a) => a.status === "needs-readme").length,
  };

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-extrabold mb-2">Agent Library</h1>
      <p className="text-muted text-sm mb-6">
        All AI audit agent repositories in the SAAF-Project organisation. Reviewed agents have been
        manually checked for code quality. Others are listed for transparency but use with caution.
      </p>

      {/* Disclaimer */}
      <div className="mb-6 p-4 bg-saaf-yellow/5 border border-saaf-yellow/20 rounded-xl text-xs text-muted leading-relaxed">
        <p className="text-saaf-yellow font-semibold mb-1">⚠ No assurance provided</p>
        <p>
          We cannot provide assurance on these agents — AI LLMs can hallucinate and red-teaming is
          not yet complete. Agents are shared as-is for research and collaboration. Validate all
          output before relying on it in real audit work.
        </p>
      </div>

      {loading ? (
        <div className="text-muted text-center py-12">Loading agents...</div>
      ) : error ? (
        <div className="bg-saaf-red/10 border border-saaf-red/30 rounded-xl p-4 text-sm text-saaf-red">
          {error}
        </div>
      ) : agents.length === 0 ? (
        <div className="text-muted text-center py-12">No agents found.</div>
      ) : (
        <>
          {/* Status filter */}
          <div className="flex gap-2 flex-wrap mb-6">
            {(["all", "reviewed", "not-reviewed", "work-in-progress", "needs-readme"] as const).map((s) => {
              const isActive = statusFilter === s;
              const label =
                s === "all" ? "All" : STATUS_META[s as AgentStatus].label.replace("✓ ", "");
              return (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg cursor-pointer transition-colors ${
                    isActive
                      ? "bg-accent text-bg"
                      : "bg-surface border border-border text-muted hover:text-text"
                  }`}
                >
                  {label} ({counts[s]})
                </button>
              );
            })}
          </div>

          {/* Agents grid */}
          <div className="grid md:grid-cols-2 gap-4">
            {filtered.map((agent) => {
              const status = STATUS_META[agent.status];
              const isReviewed = agent.status === "reviewed";
              return (
                <a
                  key={agent.name}
                  href={agent.htmlUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`block bg-surface border rounded-xl p-5 transition-all no-underline group ${
                    isReviewed ? "border-saaf-green/30 hover:border-saaf-green/50" : "border-border hover:border-accent/30"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2 flex-wrap">
                    <h3 className="text-base font-bold group-hover:text-accent transition-colors flex-1 min-w-0 break-words">
                      {agent.name}
                    </h3>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-semibold border ${status.color} shrink-0`}
                      title={status.description}
                    >
                      {status.label}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 mb-3 flex-wrap">
                    {agent.category && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold bg-saaf-purple/15 text-saaf-purple">
                        {agent.category}
                      </span>
                    )}
                    {agent.language && (
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                          LANGUAGE_COLORS[agent.language] || "bg-muted/15 text-muted"
                        }`}
                      >
                        {agent.language}
                      </span>
                    )}
                    {agent.tags.map((tag) => (
                      <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-accent/10 text-accent">
                        {tag}
                      </span>
                    ))}
                    {agent.isPrivate && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted/15 text-muted font-semibold">
                        Private
                      </span>
                    )}
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

                  {isReviewed && agent.quality && (
                    <div className="mt-3 pt-3 border-t border-saaf-green/15">
                      <div className="text-[10px] text-muted uppercase tracking-wider font-bold mb-2">
                        Quality checks
                      </div>
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        <QualityCheck ok={agent.readmeSize > 1000} label="README" />
                        <QualityCheck
                          ok={agent.quality.hasTests}
                          label={
                            agent.quality.hasTests && agent.quality.testCount
                              ? `Tests (${agent.quality.testCount})`
                              : "Tests"
                          }
                        />
                        <QualityCheck ok={agent.quality.hasSamples} label="Sample data" />
                        <QualityCheck ok={agent.recentlyUpdated} label="Recently updated" />
                      </div>
                      {agent.quality.notes && (
                        <p className="text-[11px] text-muted italic mt-2">{agent.quality.notes}</p>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-3 text-[11px] text-muted mt-3 pt-3 border-t border-border">
                    <span>Updated {new Date(agent.pushedAt).toLocaleDateString()}</span>
                    {agent.stars > 0 && <span>★ {agent.stars}</span>}
                    <span className="ml-auto text-accent">View on GitHub ↗</span>
                  </div>
                </a>
              );
            })}
          </div>
        </>
      )}

      {/* Status legend */}
      <div className="mt-8 p-4 bg-surface border border-border rounded-xl">
        <h3 className="text-xs font-bold text-muted uppercase tracking-wider mb-3">Status legend</h3>
        <div className="space-y-2 text-xs">
          {(["reviewed", "not-reviewed", "work-in-progress", "needs-readme"] as const).map((s) => (
            <div key={s} className="flex items-start gap-2">
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded font-semibold border ${STATUS_META[s].color} shrink-0`}
              >
                {STATUS_META[s].label}
              </span>
              <span className="text-muted">{STATUS_META[s].description}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Maintainer note */}
      <div className="mt-4 p-4 bg-accent/5 border border-accent/20 rounded-xl text-xs text-muted leading-relaxed">
        <p className="text-accent font-semibold mb-1">For maintainers</p>
        <p>
          To mark an agent as reviewed: edit{" "}
          <code className="bg-surface2 px-1.5 py-0.5 rounded text-text">AGENT_LIBRARY_REVIEWED</code>{" "}
          in <code className="bg-surface2 px-1.5 py-0.5 rounded text-text">src/lib/github.ts</code>{" "}
          with category, tags, and quality flags. Other repos in the org appear automatically with
          their auto-detected status.
        </p>
      </div>
    </div>
  );
}
