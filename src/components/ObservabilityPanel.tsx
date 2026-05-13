"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";

const QUESTIONS = [
  { key: "purpose", label: "1. Purpose", hint: "What does this agent do?" },
  { key: "usersStakeholders", label: "2. Users & Stakeholders", hint: "Who uses it, audits it, or could be harmed?" },
  { key: "workflow", label: "3. Workflow", hint: "Step-by-step from input to output. What do you want to observe?" },
  { key: "criticalDecisions", label: "4. Critical Decisions", hint: "Which decisions matter most? Where is risk concentrated?" },
  { key: "failureModes", label: "5. Failure Modes", hint: "Where could this go wrong? Be specific." },
  { key: "observabilityFields", label: "6. Observability Fields", hint: "What must be captured to reconstruct reasoning later?" },
  { key: "controls", label: "7. Controls", hint: "Tool allowlist, policy gates, human approvals, sampling?" },
  { key: "auditEvidence", label: "8. Audit Evidence", hint: "What must be available months later? Audit trail? Chain of thought?" },
  { key: "alertsTriggers", label: "9. Alerts & Triggers", hint: "No citation, old doc, fast approval, behaviour shift — what alerts?" },
  { key: "successMetrics", label: "10. Success Metrics", hint: "Engineering, audit, business — all in one frame." },
] as const;

type QuestionKey = typeof QUESTIONS[number]["key"];

interface Check {
  id: string;
  userId: string;
  purpose: string;
  usersStakeholders: string;
  workflow: string;
  criticalDecisions: string;
  failureModes: string;
  observabilityFields: string;
  controls: string;
  auditEvidence: string;
  alertsTriggers: string;
  successMetrics: string;
  user: { name: string | null; githubUsername: string; avatarUrl: string | null };
}

export default function ObservabilityPanel({
  planSlug,
  onCountChange,
}: {
  planSlug: string;
  onCountChange?: (count: number) => void;
}) {
  const { data: session } = useSession();
  const [checks, setChecks] = useState<Check[]>([]);
  const [myNote, setMyNote] = useState<Record<QuestionKey, string>>({
    purpose: "", usersStakeholders: "", workflow: "", criticalDecisions: "",
    failureModes: "", observabilityFields: "", controls: "", auditEvidence: "",
    alertsTriggers: "", successMetrics: "",
  });
  const [activeQuestion, setActiveQuestion] = useState<QuestionKey | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const username = (session?.user as { githubUsername?: string })?.githubUsername;

  useEffect(() => {
    fetch(`/api/observability?planSlug=${encodeURIComponent(planSlug)}`)
      .then((r) => r.json())
      .then((data: Check[]) => {
        setChecks(data);
        const mine = data.find((c) => c.user.githubUsername === username);
        if (mine) {
          setMyNote({
            purpose: mine.purpose, usersStakeholders: mine.usersStakeholders,
            workflow: mine.workflow, criticalDecisions: mine.criticalDecisions,
            failureModes: mine.failureModes, observabilityFields: mine.observabilityFields,
            controls: mine.controls, auditEvidence: mine.auditEvidence,
            alertsTriggers: mine.alertsTriggers, successMetrics: mine.successMetrics,
          });
        }
      })
      .catch(() => {});
  }, [planSlug, username]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/observability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planSlug, ...myNote }),
      });
      const data = await res.json();
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
        if (onCountChange) onCountChange(data.totalCount);
        const updated = await fetch(`/api/observability?planSlug=${encodeURIComponent(planSlug)}`).then((r) => r.json());
        setChecks(updated);
      }
    } finally {
      setSaving(false);
    }
  };

  const filledCount = Object.values(myNote).filter(Boolean).length;
  const othersChecks = checks.filter((c) => c.user.githubUsername !== username);

  return (
    <div className="border-t border-border bg-surface2/30">
      <div className="px-4 py-3 flex items-center justify-between border-b border-border">
        <div>
          <h4 className="text-sm font-bold text-text">Observability Notes</h4>
          <p className="text-[11px] text-muted mt-0.5">
            Add notes per question. Your notes are saved under your name. {checks.length > 0 && `${checks.length} contributor${checks.length !== 1 ? "s" : ""}.`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {filledCount > 0 && (
            <span className="text-[10px] text-muted">{filledCount}/10 filled</span>
          )}
          <button
            onClick={handleSave}
            disabled={saving || filledCount === 0}
            className={`text-xs px-3 py-1.5 rounded-lg font-semibold cursor-pointer transition-colors ${
              saved ? "bg-saaf-green/20 text-saaf-green" : "bg-indigo-600 hover:bg-indigo-700 text-white"
            } disabled:opacity-40`}
          >
            {saved ? "✓ Saved" : saving ? "Saving..." : "Save notes"}
          </button>
        </div>
      </div>

      <div className="divide-y divide-border/50">
        {QUESTIONS.map((q) => {
          const isActive = activeQuestion === q.key;
          const hasMyNote = !!myNote[q.key];
          const othersForQ = othersChecks.filter((c) => c[q.key]);

          return (
            <div key={q.key}>
              <button
                onClick={() => setActiveQuestion(isActive ? null : q.key)}
                className="w-full text-left px-4 py-2.5 flex items-center gap-3 hover:bg-white/3 transition-colors cursor-pointer"
              >
                <span className="text-[10px] text-muted w-4">{isActive ? "▼" : "▶"}</span>
                <span className="text-xs font-semibold text-text flex-1">{q.label}</span>
                <div className="flex items-center gap-1.5">
                  {hasMyNote && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/15 text-accent font-semibold">You</span>
                  )}
                  {othersForQ.length > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-saaf-green/12 text-saaf-green font-semibold">
                      +{othersForQ.length}
                    </span>
                  )}
                </div>
              </button>

              {isActive && (
                <div className="px-4 pb-4 space-y-3">
                  <p className="text-[11px] text-muted italic">{q.hint}</p>

                  {/* Others' notes */}
                  {othersForQ.map((check) => (
                    <div key={check.id} className="flex gap-2.5">
                      <img
                        src={check.user.avatarUrl || `https://github.com/${check.user.githubUsername}.png?size=32`}
                        alt=""
                        className="w-6 h-6 rounded-full border border-border shrink-0 mt-0.5"
                      />
                      <div className="flex-1 bg-surface rounded-lg p-2.5">
                        <div className="text-[10px] text-muted mb-1 font-medium">
                          {check.user.name || check.user.githubUsername}
                        </div>
                        <p className="text-xs text-text leading-relaxed whitespace-pre-wrap">{check[q.key]}</p>
                      </div>
                    </div>
                  ))}

                  {/* My note */}
                  <div className="flex gap-2.5">
                    <img
                      src={session?.user?.image || `https://github.com/${username}.png?size=32`}
                      alt=""
                      className="w-6 h-6 rounded-full border border-accent/40 shrink-0 mt-0.5"
                    />
                    <div className="flex-1">
                      <div className="text-[10px] text-accent mb-1 font-medium">Your note</div>
                      <textarea
                        value={myNote[q.key]}
                        onChange={(e) => setMyNote({ ...myNote, [q.key]: e.target.value })}
                        placeholder={`Add your note on "${q.label}"...`}
                        rows={3}
                        className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-xs text-text focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 resize-none leading-relaxed"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
