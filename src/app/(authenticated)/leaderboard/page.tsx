"use client";

import { useEffect, useState, useRef } from "react";
import LeaderboardCard from "@/components/LeaderboardCard";
import ActivityFeed from "@/components/ActivityFeed";
import type { ScoreEntry, ActivityEntry } from "@/types";

export default function LeaderboardPage() {
  const [filter, setFilter] = useState("all");
  const [scores, setScores] = useState<ScoreEntry[]>([]);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [stats, setStats] = useState<{
    contributors: number;
    mergedPRs: number;
    planFilesTouched: number;
    totalPlans: number;
    agentBuilders: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<ScoreEntry | null>(null);
  const [tooltip, setTooltip] = useState<string | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/leaderboard?filter=${filter}`)
      .then((r) => r.json())
      .then((data) => {
        setScores(data.scores || []);
        setActivity(data.activity || []);
        setStats(data.stats || null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [filter]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-extrabold">Leaderboard</h1>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="px-3 py-1.5 bg-surface border border-border rounded-lg text-sm text-text focus:outline-none focus:border-accent"
        >
          <option value="all">All time</option>
          <option value="h3">Since Hackathon #3</option>
          <option value="h2">Since Hackathon #2</option>
        </select>
      </div>

      {/* Scoring rules */}
      <div className="relative flex items-center gap-1.5 flex-wrap p-2 px-3 bg-surface border border-accent/12 rounded-lg mb-4 text-xs">
        <span className="text-[11px] font-bold text-muted uppercase tracking-wider mr-1">Score</span>
        {[
          {
            label: "+10 Merged PR", cap: "max 5", color: "bg-saaf-green/12 text-saaf-green",
            info: "Open a PR to the SAAF-Project/SAAF-Project repo and get it merged. Fork the repo, make your changes, and submit via gh pr create. Each merged PR = 10 pts (capped at 5 PRs = 50 pts)."
          },
          {
            label: "+15 New plan", cap: "max 3", color: "bg-accent/15 text-accent",
            info: "Add a new plan file to plans/hackathon-X/ in your PR. Copy the template from docs/plans/plan-template.md and fill in at least sections 1–3. Each new plan file = 15 pts (capped at 3 = 45 pts)."
          },
          {
            label: "+5 Plan update", cap: "no cap", color: "bg-saaf-purple/12 text-saaf-purple",
            info: "Edit an existing plan file in your PR — update the PDCA status, improve sections, add prompts or findings. Each unique plan file updated = 5 pts (no cap)."
          },
          {
            label: "+5 Claim", cap: "max 2", color: "bg-saaf-yellow/12 text-saaf-yellow",
            info: "Signal that you are implementing a plan at your organisation. Open any plan file, find the 'Claimed By' field in Section 1 metadata, and set it to your name. This prevents duplication and shows the community what's being built. Each claim = 5 pts (capped at 2 = 10 pts)."
          },
          {
            label: "+8 Agent repo", cap: "max 2", color: "bg-saaf-orange/12 text-saaf-orange",
            info: "Build an agent in your own SAAF-Project org repo. A repo with a real README earns +8 (your best 2 count); a reviewed agent earns +20. Plus a small bonus for lines changed in your repos (capped at +10). Quality-gated: empty or work-in-progress repos earn nothing. Reflects your current repo portfolio across all filters."
          },
        ].map((item, idx, arr) => (
          <span key={item.label} className="relative">
            <span className={`flex items-center gap-1 px-2 py-0.5 rounded font-bold cursor-default ${item.color}`}>
              {item.label}
              <small className="font-normal opacity-70">{item.cap}</small>
              <button
                className="ml-0.5 opacity-50 hover:opacity-100 cursor-pointer text-[10px] leading-none"
                onMouseEnter={() => setTooltip(item.label)}
                onMouseLeave={() => setTooltip(null)}
              >
                ⓘ
              </button>
            </span>
            {tooltip === item.label && (
              <div className={`absolute bottom-full mb-2 w-64 p-3 bg-surface2 border border-border rounded-xl text-[11px] text-muted leading-relaxed z-50 shadow-xl font-normal ${idx >= arr.length - 2 ? "right-0" : "left-0"}`}>
                {item.info}
              </div>
            )}
          </span>
        ))}
      </div>

      {loading ? (
        <div className="text-muted text-center py-12">Loading leaderboard...</div>
      ) : (
        <div className="grid md:grid-cols-[1fr_380px] gap-6">
          {/* Rankings */}
          <div>
            <h2 className="text-xs font-bold text-muted uppercase tracking-wider mb-3">
              Rankings
            </h2>
            {scores.length === 0 ? (
              <p className="text-muted text-sm p-6 text-center bg-surface border border-border rounded-xl">
                No contributions found yet.
              </p>
            ) : (
              scores.map((entry, i) => (
                <LeaderboardCard
                  key={entry.login}
                  entry={entry}
                  rank={i}
                  onClick={() => setSelectedUser(entry)}
                />
              ))
            )}
          </div>

          {/* Activity */}
          <div>
            <h2 className="text-xs font-bold text-muted uppercase tracking-wider mb-3">
              Recent Activity
            </h2>
            <div className="bg-surface border border-border rounded-xl p-4">
              <ActivityFeed entries={activity.slice(0, 15)} />
            </div>
          </div>
        </div>
      )}

      {/* Stats bar */}
      {stats && (
        <div className="mt-6 flex items-center gap-5 text-xs text-muted border-t border-border pt-4">
          <span>
            <strong className="text-text">{stats.contributors}</strong>{" "}
            contributors
          </span>
          <span>
            <strong className="text-text">{stats.mergedPRs}</strong> merged PRs
          </span>
          <span>
            <strong className="text-text">{stats.planFilesTouched}</strong> plan
            files touched
          </span>
          <span>
            <strong className="text-text">{stats.totalPlans}</strong> plans in
            portfolio
          </span>
          <span>
            <strong className="text-text">{stats.agentBuilders}</strong> agent
            builders
          </span>
        </div>
      )}

      {/* Score detail modal */}
      {selectedUser && (
        <div
          className="fixed inset-0 bg-bg/85 z-50 flex items-center justify-center backdrop-blur-sm"
          onClick={() => setSelectedUser(null)}
        >
          <div
            className="bg-surface border border-border rounded-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto p-6 relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setSelectedUser(null)}
              className="absolute top-3 right-4 text-muted text-xl hover:text-text cursor-pointer"
            >
              ×
            </button>

            <div className="flex items-center gap-4 mb-5">
              <img
                src={`https://github.com/${selectedUser.login}.png?size=96`}
                alt={selectedUser.login}
                className="w-12 h-12 rounded-full border-2 border-border"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
              <h3 className="text-lg font-bold">@{selectedUser.login}</h3>
              <div className="ml-auto text-3xl font-black">
                {selectedUser.total}{" "}
                <span className="text-sm text-muted font-medium">pts</span>
              </div>
            </div>

            {selectedUser.prList.length === 0 &&
            selectedUser.agentPoints === 0 ? (
              <p className="text-muted text-sm">
                No scored contributions yet.
              </p>
            ) : (
              <div className="space-y-0">
                {selectedUser.prList.map((pr) => (
                  <div
                    key={pr.num}
                    className="flex items-center gap-3 py-2 border-b border-white/4 last:border-b-0 text-sm"
                  >
                    <span className="text-saaf-green font-extrabold min-w-[40px] text-right">
                      +10
                    </span>
                    <span className="flex-1 text-muted">
                      Merged{" "}
                      <a
                        href={pr.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-accent"
                      >
                        PR #{pr.num}
                      </a>
                      :{" "}
                      <strong className="text-text">{pr.title}</strong>
                    </span>
                  </div>
                ))}
                {selectedUser.newPlans > 0 && (
                  <div className="flex items-center gap-3 py-2 border-b border-white/4 text-sm">
                    <span className="text-saaf-green font-extrabold min-w-[40px] text-right">
                      +{selectedUser.newPlans * 15}
                    </span>
                    <span className="text-muted">
                      {selectedUser.newPlans} new plan
                      {selectedUser.newPlans !== 1 ? "s" : ""}
                    </span>
                  </div>
                )}
                {selectedUser.updateCount > 0 && (
                  <div className="flex items-center gap-3 py-2 border-b border-white/4 text-sm">
                    <span className="text-saaf-green font-extrabold min-w-[40px] text-right">
                      +{selectedUser.updateCount * 5}
                    </span>
                    <span className="text-muted">
                      {selectedUser.updateCount} plan update
                      {selectedUser.updateCount !== 1 ? "s" : ""}
                    </span>
                  </div>
                )}
                {selectedUser.claims > 0 && (
                  <div className="flex items-center gap-3 py-2 text-sm">
                    <span className="text-saaf-green font-extrabold min-w-[40px] text-right">
                      +{selectedUser.claims * 5}
                    </span>
                    <span className="text-muted">
                      {selectedUser.claims} claim
                      {selectedUser.claims !== 1 ? "s" : ""}
                    </span>
                  </div>
                )}
                {selectedUser.agentPoints > 0 && (
                  <div className="flex items-start gap-3 py-2 border-t border-white/4 text-sm">
                    <span className="text-saaf-orange font-extrabold min-w-[40px] text-right">
                      +{selectedUser.agentPoints}
                    </span>
                    <span className="text-muted">
                      Agent Builder: {selectedUser.agentRepos.length} repo
                      {selectedUser.agentRepos.length !== 1 ? "s" : ""}
                      <span className="block text-[11px] mt-0.5">
                        {selectedUser.agentRepos.map((r, i) => (
                          <span key={r.name}>
                            {i > 0 && ", "}
                            {r.name}
                            {r.reviewed && (
                              <span className="text-saaf-green"> ✓</span>
                            )}
                          </span>
                        ))}
                      </span>
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
