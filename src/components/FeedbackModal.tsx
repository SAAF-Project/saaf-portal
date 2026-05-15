"use client";

import { useState } from "react";

const CATEGORIES = [
  { value: "portal", label: "About the Portal" },
  { value: "saaf-project", label: "About SAAF Project" },
  { value: "bug", label: "Bug report" },
  { value: "feature", label: "Feature request" },
  { value: "general", label: "General" },
];

export default function FeedbackModal({ onClose }: { onClose: () => void }) {
  const [category, setCategory] = useState("");
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim().length < 10) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: category || undefined, text }),
      });
      if (res.ok) {
        setSubmitted(true);
        setTimeout(onClose, 2000);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-bg/85 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Give feedback"
      data-feedback-modal
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-surface border border-border rounded-2xl w-full max-w-lg shadow-2xl">
        {submitted ? (
          <div className="p-8 text-center">
            <div className="text-4xl mb-3">✓</div>
            <h2 className="text-lg font-bold mb-1">Thanks for your feedback!</h2>
            <p className="text-muted text-sm">
              We&apos;ll review it and use it to improve the portal and the SAAF Project.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="p-6 border-b border-border">
              <h2 className="text-lg font-bold">Help us improve</h2>
              <p className="text-muted text-xs mt-1">
                Your feedback shapes both the SAAF Project and this portal.
              </p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs text-muted font-medium mb-1">
                  What is this about? (optional)
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm text-text focus:outline-none focus:border-accent"
                >
                  <option value="">Choose a category...</option>
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-muted font-medium mb-1">
                  Your feedback *
                </label>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={6}
                  required
                  minLength={10}
                  placeholder="Tell us what's working, what's not, what's missing — anything goes."
                  className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm text-text focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 resize-none leading-relaxed"
                />
                <p className="text-[11px] text-muted mt-1">
                  {text.trim().length} / minimum 10 characters
                </p>
              </div>
            </div>
            <div className="flex gap-2 p-4 border-t border-border">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm border border-border rounded-lg text-muted hover:text-text cursor-pointer"
              >
                Cancel
              </button>
              <div className="flex-1" />
              <button
                type="submit"
                disabled={submitting || text.trim().length < 10}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg disabled:opacity-50 cursor-pointer"
              >
                {submitting ? "Sending..." : "Send feedback"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
