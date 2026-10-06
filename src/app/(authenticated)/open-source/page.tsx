"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import UserAvatar from "@/components/UserAvatar";
import type { ClaimRole, ReadinessRepo } from "@/types";

const SKILL_URL =
  "https://github.com/SAAF-Project/SAAF-Project/blob/main/.claude/skills/harden-agent-repo/SKILL.md";
const TEMPLATE_URL =
  "https://github.com/SAAF-Project/SAAF-Project/blob/main/docs/conventions/audit-criteria-template.md";
const AGENT_AUDITOR_URL = "https://github.com/SAAF-Project/Agent-Auditor";
const INSTALL_CMD =
  "mkdir -p ~/.claude/skills/harden-agent-repo && gh api repos/SAAF-Project/SAAF-Project/contents/.claude/skills/harden-agent-repo/SKILL.md --jq .content | base64 -d > ~/.claude/skills/harden-agent-repo/SKILL.md";

type TeamState = "unclaimed" | "needs-auditor" | "needs-dev" | "active" | "pr-open" | "ready";
type Filter = "all" | "open" | "needs-auditor" | "needs-dev" | "in-progress" | "ready";

function teamState(r: ReadinessRepo): TeamState {
  if (r.ready) return "ready";
  if (!r.claim) return "unclaimed";
  if (r.claim.prUrl) return "pr-open";
  const hasDev = r.claim.members.some((m) => m.role === "dev");
  const hasAuditor = r.claim.members.some((m) => m.role === "auditor");
  if (hasDev && hasAuditor) return "active";
  return hasDev ? "needs-auditor" : "needs-dev";
}

const STATE_META: Record<TeamState, { label: string; color: string }> = {
  unclaimed: { label: "Open — claim it", color: "bg-accent/12 text-accent border-accent/30" },
  "needs-auditor": { label: "Needs an auditor", color: "bg-saaf-yellow/15 text-saaf-yellow border-saaf-yellow/30" },
  "needs-dev": { label: "Needs a developer", color: "bg-saaf-yellow/15 text-saaf-yellow border-saaf-yellow/30" },
  active: { label: "Team complete — working", color: "bg-saaf-purple/15 text-saaf-purple border-saaf-purple/30" },
  "pr-open": { label: "PR open — awaiting review", color: "bg-saaf-orange/15 text-saaf-orange border-saaf-orange/30" },
  ready: { label: "✓ Open-source ready", color: "bg-saaf-green/15 text-saaf-green border-saaf-green/30" },
};

const FILTERS: { key: Filter; label: string; match: (s: TeamState) => boolean }[] = [
  { key: "all", label: "All", match: () => true },
  { key: "open", label: "Unclaimed", match: (s) => s === "unclaimed" },
  { key: "needs-auditor", label: "Needs auditor", match: (s) => s === "needs-auditor" },
  { key: "needs-dev", label: "Needs developer", match: (s) => s === "needs-dev" },
  { key: "in-progress", label: "In progress", match: (s) => s === "active" || s === "pr-open" },
  { key: "ready", label: "Ready", match: (s) => s === "ready" },
];

function Check({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-semibold ${
        ok ? "bg-saaf-green/12 text-saaf-green" : "bg-border/50 text-muted"
      }`}
    >
      <span>{ok ? "✓" : "○"}</span>
      <span>{label}</span>
    </span>
  );
}

function Stat({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total ? Math.round((value / total) * 100) : 0;
  return (
    <div className="bg-surface border border-border rounded-xl p-4">
      <div className="text-muted text-xs font-medium mb-1">{label}</div>
      <div className="text-2xl font-black">
        {value}
        <span className="text-sm text-muted font-semibold"> / {total}</span>
      </div>
      <div className="h-1.5 bg-surface2 rounded-full mt-2 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function OpenSourcePage() {
  const { data: session } = useSession();
  const username = (session?.user as { githubUsername?: string })?.githubUsername;
  const [repos, setRepos] = useState<ReadinessRepo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [busy, setBusy] = useState<string | null>(null);
  const [prDrafts, setPrDrafts] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);

  const load = useCallback(
    () =>
      fetch("/api/repo-claims")
        .then((r) => r.json())
        .then((d) => {
          if (Array.isArray(d)) setRepos(d);
          else if (d?.error) setError(String(d.error));
        })
        .catch(() => setError("Failed to load agent repos"))
        .finally(() => setLoading(false)),
    []
  );

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (repo: string, init: RequestInit, url = "/api/repo-claims") => {
    setBusy(repo);
    setError(null);
    const res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...init });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error || "Something went wrong");
    }
    await load();
    setBusy(null);
  };

  const join = (repo: string, role: ClaimRole) =>
    act(repo, { method: "POST", body: JSON.stringify({ repo, role }) });
  const leave = (repo: string) =>
    act(repo, { method: "DELETE" }, `/api/repo-claims?repo=${encodeURIComponent(repo)}`);
  const savePr = (repo: string) =>
    act(repo, { method: "PATCH", body: JSON.stringify({ repo, prUrl: prDrafts[repo] || "" }) });

  const total = repos.length;
  const readyCount = repos.filter((r) => r.ready).length;
  const criteriaCount = repos.filter((r) => r.hasAuditCriteria).length;
  const reviewedCount = repos.filter((r) => r.reviewed).length;
  const activeTeams = repos.filter((r) => ["active", "pr-open"].includes(teamState(r))).length;

  const activeFilter = FILTERS.find((f) => f.key === filter)!;
  const filtered = repos.filter((r) => activeFilter.match(teamState(r)));
  const myRepos = repos.filter((r) => r.claim?.members.some((m) => m.username === username));

  return (
    <div className="max-w-5xl mx-auto">
      <div className="inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full bg-saaf-green/15 text-saaf-green mb-3">
        Hackathon #9 · Just Eat Takeaway · 6 October
      </div>
      <h1 className="text-2xl font-extrabold mb-2">Open-Source Readiness</h1>
      <p className="text-muted text-sm mb-6 max-w-3xl">
        Every SAAF agent repo is going public. Developers and auditors team up to get each agent
        to an open-source quality bar — and help sharpen the skill that will eventually do this
        autonomously across every agent in SAAF.
      </p>

      {/* How it works */}
      <div className="grid md:grid-cols-3 gap-3 mb-6">
        {[
          {
            n: "1",
            title: "Form a team",
            body: "At least 1 developer + 1 auditor per repo. The developer drives the code, the auditor owns the control objectives and acceptance criteria.",
          },
          {
            n: "2",
            title: "Claim a repo below",
            body: "Claim as dev or auditor. Already claimed? Join that team — one team per repo, so you collaborate instead of competing.",
          },
          {
            n: "3",
            title: "Run /harden-agent-repo",
            body: "The skill cleans up the repo, interviews you into an AUDIT-CRITERIA.md and opens the PR. Paste the PR link on your card.",
          },
        ].map((s) => (
          <div key={s.n} className="bg-surface border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-6 h-6 rounded-full bg-accent text-bg text-xs font-black flex items-center justify-center">
                {s.n}
              </span>
              <span className="font-bold text-sm">{s.title}</span>
            </div>
            <p className="text-xs text-muted leading-relaxed">{s.body}</p>
          </div>
        ))}
      </div>

      {/* Progress */}
      <h2 className="text-xs font-bold text-muted uppercase tracking-wider mb-3">Where we are</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
        <Stat label="Open-source ready" value={readyCount} total={total} color="bg-saaf-green" />
        <Stat label="Has AUDIT-CRITERIA.md" value={criteriaCount} total={total} color="bg-saaf-purple" />
        <Stat label="Reviewed" value={reviewedCount} total={total} color="bg-accent" />
        <Stat label="Complete teams" value={activeTeams} total={total} color="bg-saaf-orange" />
      </div>
      <p className="text-[11px] text-muted mb-6">
        <strong className="text-text">Ready</strong> = reviewed by maintainers (working code,
        runnable interface, dependency manifest) <strong className="text-text">and</strong> a
        merged <code className="bg-surface2 px-1 rounded">AUDIT-CRITERIA.md</code> next to the
        README. After your PR merges, maintainers review the repo and it turns green here.
      </p>

      {/* My teams */}
      {myRepos.length > 0 && (
        <div className="mb-6 p-4 bg-accent/5 border border-accent/20 rounded-xl">
          <h2 className="text-xs font-bold text-accent uppercase tracking-wider mb-2">Your teams</h2>
          <div className="flex flex-wrap gap-2">
            {myRepos.map((r) => (
              <a
                key={r.name}
                href={`#repo-${r.name}`}
                className="text-xs px-2 py-1 rounded-lg bg-surface border border-border no-underline hover:border-accent/40"
              >
                {r.name} · <span className="text-muted">{STATE_META[teamState(r)].label}</span>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Repo grid */}
      <h2 className="text-xs font-bold text-muted uppercase tracking-wider mb-3">Claim an agent repo</h2>
      {error && (
        <div className="mb-4 bg-saaf-red/10 border border-saaf-red/30 rounded-xl p-3 text-sm text-saaf-red">
          {error}
        </div>
      )}
      {loading ? (
        <div className="text-muted text-center py-12">Loading agent repos...</div>
      ) : (
        <>
          <div className="flex gap-2 flex-wrap mb-4">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg cursor-pointer transition-colors ${
                  filter === f.key
                    ? "bg-accent text-bg"
                    : "bg-surface border border-border text-muted hover:text-text"
                }`}
              >
                {f.label} ({repos.filter((r) => f.match(teamState(r))).length})
              </button>
            ))}
          </div>

          <div className="grid md:grid-cols-2 gap-4 mb-8">
            {filtered.map((r) => {
              const state = teamState(r);
              const meta = STATE_META[state];
              const members = r.claim?.members || [];
              const isMember = members.some((m) => m.username === username);
              const hasDev = members.some((m) => m.role === "dev");
              const hasAuditor = members.some((m) => m.role === "auditor");
              return (
                <div
                  key={r.name}
                  id={`repo-${r.name}`}
                  className={`bg-surface border rounded-xl p-5 ${
                    r.ready ? "border-saaf-green/30" : isMember ? "border-accent/40" : "border-border"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2 flex-wrap">
                    <a
                      href={r.htmlUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-base font-bold hover:text-accent no-underline flex-1 min-w-0 break-words"
                    >
                      {r.name} ↗
                    </a>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold border shrink-0 ${meta.color}`}>
                      {meta.label}
                    </span>
                  </div>

                  {r.description && <p className="text-xs text-muted leading-relaxed mb-3">{r.description}</p>}

                  <div className="flex flex-wrap gap-1.5 mb-3">
                    <Check ok={r.reviewed} label="Reviewed" />
                    <Check ok={r.hasAuditCriteria} label="AUDIT-CRITERIA.md" />
                    {r.language && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted/15 text-muted font-semibold">
                        {r.language}
                      </span>
                    )}
                  </div>

                  {/* Team */}
                  <div className="pt-3 border-t border-border">
                    <div className="text-[10px] text-muted uppercase tracking-wider font-bold mb-2">Team</div>
                    {members.length === 0 ? (
                      <p className="text-xs text-muted mb-3">No team yet.</p>
                    ) : (
                      <div className="flex flex-wrap gap-2 mb-3">
                        {members.map((m) => (
                          <span
                            key={m.username}
                            className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg bg-surface2"
                          >
                            <UserAvatar src={m.avatarUrl} alt={m.username} size={18} />
                            {m.name || m.username}
                            <span
                              className={`text-[9px] uppercase font-bold px-1 rounded ${
                                m.role === "dev" ? "bg-accent/15 text-accent" : "bg-saaf-purple/15 text-saaf-purple"
                              }`}
                            >
                              {m.role}
                            </span>
                          </span>
                        ))}
                      </div>
                    )}

                    {!r.ready && (
                      <div className="flex flex-wrap gap-2">
                        {!isMember && (
                          <>
                            <button
                              disabled={busy === r.name}
                              onClick={() => join(r.name, "dev")}
                              className={`px-3 py-1.5 text-xs font-semibold rounded-lg cursor-pointer disabled:opacity-50 ${
                                hasDev ? "bg-surface border border-border text-muted hover:text-text" : "bg-accent text-bg"
                              }`}
                            >
                              {members.length === 0 ? "Claim as developer" : "Join as developer"}
                            </button>
                            <button
                              disabled={busy === r.name}
                              onClick={() => join(r.name, "auditor")}
                              className={`px-3 py-1.5 text-xs font-semibold rounded-lg cursor-pointer disabled:opacity-50 ${
                                hasAuditor
                                  ? "bg-surface border border-border text-muted hover:text-text"
                                  : "bg-saaf-purple text-bg"
                              }`}
                            >
                              {members.length === 0 ? "Claim as auditor" : "Join as auditor"}
                            </button>
                          </>
                        )}
                        {isMember && (
                          <>
                            <input
                              type="url"
                              placeholder={r.claim?.prUrl || `https://github.com/SAAF-Project/${r.name}/pull/…`}
                              value={prDrafts[r.name] ?? ""}
                              onChange={(e) => setPrDrafts({ ...prDrafts, [r.name]: e.target.value })}
                              className="flex-1 min-w-[180px] text-xs px-2 py-1.5 rounded-lg bg-surface2 border border-border"
                            />
                            <button
                              disabled={busy === r.name}
                              onClick={() => savePr(r.name)}
                              className="px-3 py-1.5 text-xs font-semibold rounded-lg cursor-pointer bg-accent text-bg disabled:opacity-50"
                            >
                              Save PR link
                            </button>
                            <button
                              disabled={busy === r.name}
                              onClick={() => leave(r.name)}
                              className="px-3 py-1.5 text-xs font-semibold rounded-lg cursor-pointer bg-surface border border-border text-muted hover:text-saaf-red disabled:opacity-50"
                            >
                              Leave team
                            </button>
                          </>
                        )}
                      </div>
                    )}
                    {r.claim?.prUrl && (
                      <a
                        href={r.claim.prUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block text-xs text-accent mt-2 no-underline hover:underline"
                      >
                        Hardening PR ↗
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* The skill */}
      <div className="grid md:grid-cols-2 gap-4 mb-4">
        <div className="bg-surface border border-border rounded-xl p-5">
          <h2 className="text-sm font-bold mb-2">Run the skill</h2>
          <p className="text-xs text-muted leading-relaxed mb-3">
            Install <code className="bg-surface2 px-1 rounded">harden-agent-repo</code> once as a
            personal Claude Code skill, then run it from inside the cloned agent repo:
          </p>
          <div className="relative mb-3">
            <pre className="text-[10px] bg-surface2 rounded-lg p-3 pr-14 overflow-x-auto whitespace-pre-wrap break-all">
              {INSTALL_CMD}
            </pre>
            <button
              onClick={() => {
                navigator.clipboard.writeText(INSTALL_CMD);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
              className="absolute top-2 right-2 text-[10px] px-2 py-1 rounded bg-accent text-bg cursor-pointer"
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <ol className="text-xs text-muted space-y-1 list-decimal pl-4 mb-3">
            <li>
              <code className="bg-surface2 px-1 rounded">gh repo clone SAAF-Project/&lt;repo&gt;</code> and{" "}
              <code className="bg-surface2 px-1 rounded">cd</code> into it
            </li>
            <li>
              Start <code className="bg-surface2 px-1 rounded">claude</code> and type{" "}
              <code className="bg-surface2 px-1 rounded">/harden-agent-repo</code>
            </li>
            <li>Developer + auditor answer the interview together</li>
            <li>The skill opens the PR — paste the link on your card above</li>
          </ol>
          <div className="flex gap-3 text-xs">
            <a href={SKILL_URL} target="_blank" rel="noopener noreferrer" className="text-accent no-underline hover:underline">
              Read SKILL.md ↗
            </a>
            <a href={TEMPLATE_URL} target="_blank" rel="noopener noreferrer" className="text-accent no-underline hover:underline">
              AUDIT-CRITERIA template ↗
            </a>
          </div>
        </div>

        <div className="bg-surface border border-saaf-purple/25 rounded-xl p-5">
          <h2 className="text-sm font-bold mb-2">Sharpen the skill</h2>
          <p className="text-xs text-muted leading-relaxed mb-3">
            The skill is only as good as the lessons fed into it. Every run against a real repo is a
            chance to make it better for the next team.
          </p>
          <ul className="text-xs text-muted space-y-1 list-disc pl-4 mb-3">
            <li>Did it ask the wrong question, or miss a check an auditor would expect? Fix the step.</li>
            <li>Found a pattern (secrets, branch drift, padded frameworks)? Add it as a real example.</li>
            <li>
              Submit improvements as a PR to{" "}
              <code className="bg-surface2 px-1 rounded">.claude/skills/harden-agent-repo/SKILL.md</code>{" "}
              in SAAF-Project.
            </li>
          </ul>
          <p className="text-[11px] text-muted">
            Auditors: your scepticism is the input — sharpen the acceptance-criteria step.
            Developers: make the cleanup and PR steps more robust.
          </p>
        </div>
      </div>

      {/* Vision */}
      <div className="mb-4 p-5 bg-gradient-to-r from-accent/8 to-saaf-purple/8 border border-accent/20 rounded-xl">
        <h2 className="text-sm font-bold mb-2">Towards an army of agents</h2>
        <p className="text-xs text-muted leading-relaxed mb-2">
          Today humans run the skill repo by repo. The goal: every skill agent (hardening, review,
          stress-testing) bundled together, continuously and autonomously sweeping all SAAF agent
          repos — with{" "}
          <a href={AGENT_AUDITOR_URL} target="_blank" rel="noopener noreferrer" className="text-accent no-underline hover:underline">
            Agent-Auditor
          </a>{" "}
          grading every <code className="bg-surface2 px-1 rounded">AUDIT-CRITERIA.md</code> at org scale.
        </p>
        <p className="text-xs text-muted leading-relaxed">
          That gives us a quality standard we can stand behind: every public SAAF agent sits above
          it with a reasonable degree of assurance. What you fix and sharpen today is the training
          ground for that army.
        </p>
      </div>
    </div>
  );
}
