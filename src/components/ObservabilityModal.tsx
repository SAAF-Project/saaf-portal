"use client";

import { useState, useEffect } from "react";

const FIELDS = [
  { key: "purpose", label: "1. Purpose", placeholder: "What does this agent do? Describe its primary function and goal." },
  { key: "usersStakeholders", label: "2. Users & Stakeholders", placeholder: "Who uses it? Who audits it? Who could be harmed if it fails?" },
  { key: "workflow", label: "3. Workflow", placeholder: "Step-by-step path from user input to final output. What do you want to observe? Flows? Steps?" },
  { key: "criticalDecisions", label: "4. Critical Decisions", placeholder: "Which decisions matter most? Where is the risk concentrated?" },
  { key: "failureModes", label: "5. Failure Modes", placeholder: "Where could this go wrong? Be specific." },
  { key: "observabilityFields", label: "6. Observability Fields", placeholder: "What must be captured to reconstruct the agent's reasoning later?" },
  { key: "controls", label: "7. Controls", placeholder: "Tool allowlist, policy gates, human approvals, sampling rates?" },
  { key: "auditEvidence", label: "8. Audit Evidence", placeholder: "What must be available months later to support the conclusion? Audit trail? Chain of thought?" },
  { key: "alertsTriggers", label: "9. Alerts & Triggers", placeholder: "No citation used, old document referenced, fast approval, behaviour shift — what alerts should be built in?" },
  { key: "successMetrics", label: "10. Success Metrics", placeholder: "Engineering, audit, business — all in one frame." },
] as const;

type FieldKey = typeof FIELDS[number]["key"];
type FormData = Record<FieldKey, string>;

const EMPTY: FormData = {
  purpose: "", usersStakeholders: "", workflow: "", criticalDecisions: "",
  failureModes: "", observabilityFields: "", controls: "", auditEvidence: "",
  alertsTriggers: "", successMetrics: "",
};

interface CheckData {
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
}

export default function ObservabilityModal({
  planSlug,
  planTitle,
  onClose,
  onSubmitted,
}: {
  planSlug: string;
  planTitle: string;
  onClose: () => void;
  onSubmitted: (newCount: number) => void;
}) {
  const [form, setForm] = useState<FormData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeField, setActiveField] = useState(0);

  useEffect(() => {
    fetch(`/api/observability?planSlug=${encodeURIComponent(planSlug)}`)
      .then((r) => r.json())
      .then((checks: CheckData[]) => {
        const mine = checks[0];
        if (mine) {
          setForm({
            purpose: mine.purpose, usersStakeholders: mine.usersStakeholders,
            workflow: mine.workflow, criticalDecisions: mine.criticalDecisions,
            failureModes: mine.failureModes, observabilityFields: mine.observabilityFields,
            controls: mine.controls, auditEvidence: mine.auditEvidence,
            alertsTriggers: mine.alertsTriggers, successMetrics: mine.successMetrics,
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [planSlug]);

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/observability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planSlug, ...form }),
      });
      const data = await res.json();
      if (res.ok) {
        onSubmitted(data.totalCount);
        onClose();
      }
    } finally {
      setSaving(false);
    }
  };

  const filled = Object.values(form).filter(Boolean).length;

  return (
    <div
      className="fixed inset-0 bg-bg/90 z-50 flex items-start justify-center pt-8 pb-8 backdrop-blur-sm overflow-y-auto"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-surface border border-border rounded-2xl w-full max-w-3xl mx-4 shadow-2xl">
        <div className="flex items-start justify-between p-6 border-b border-border">
          <div>
            <h2 className="text-lg font-bold">Observability Check</h2>
            <p className="text-muted text-sm mt-0.5 truncate max-w-md">{planTitle}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted">{filled}/10 filled</span>
            <button onClick={onClose} className="text-muted hover:text-text text-xl cursor-pointer">×</button>
          </div>
        </div>

        <div className="h-1 bg-border">
          <div
            className="h-full bg-gradient-to-r from-accent to-saaf-purple transition-all duration-300"
            style={{ width: `${(filled / 10) * 100}%` }}
          />
        </div>

        <div className="flex gap-1 p-3 border-b border-border overflow-x-auto">
          {FIELDS.map((f, i) => (
            <button
              key={f.key}
              onClick={() => setActiveField(i)}
              className={`shrink-0 px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                activeField === i
                  ? "bg-accent/20 text-accent"
                  : form[f.key]
                    ? "bg-saaf-green/10 text-saaf-green"
                    : "text-muted hover:text-text"
              }`}
            >
              {i + 1}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="p-6 text-muted text-sm">Loading...</div>
        ) : (
          <div className="p-6">
            <div className="mb-4">
              <label className="block text-sm font-bold text-text mb-1">
                {FIELDS[activeField].label}
              </label>
              <textarea
                value={form[FIELDS[activeField].key]}
                onChange={(e) => setForm({ ...form, [FIELDS[activeField].key]: e.target.value })}
                placeholder={FIELDS[activeField].placeholder}
                rows={6}
                className="w-full px-3 py-2.5 bg-bg border border-border rounded-lg text-sm text-text focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 resize-none leading-relaxed"
              />
            </div>

            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setActiveField(Math.max(0, activeField - 1))}
                disabled={activeField === 0}
                className="px-4 py-2 text-sm border border-border rounded-lg text-muted hover:text-text disabled:opacity-30 cursor-pointer"
              >
                ← Previous
              </button>
              <button
                onClick={() => setActiveField(Math.min(9, activeField + 1))}
                disabled={activeField === 9}
                className="px-4 py-2 text-sm border border-border rounded-lg text-muted hover:text-text disabled:opacity-30 cursor-pointer"
              >
                Next →
              </button>
              <div className="flex-1" />
              <button
                onClick={handleSubmit}
                disabled={saving || filled === 0}
                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl cursor-pointer transition-colors"
              >
                {saving ? "Saving..." : "Submit check"}
              </button>
            </div>

            <p className="text-[11px] text-muted">
              Fill in as many fields as possible. Your check is saved and can be updated later.
              Each submitted check contributes to your Observability Badge.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
