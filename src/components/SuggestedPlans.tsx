"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { SuggestedPlanWithReasons } from "@/types";

export default function SuggestedPlans() {
  const [plans, setPlans] = useState<SuggestedPlanWithReasons[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/suggestions")
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setPlans(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading || plans.length === 0) return null;

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-bold text-muted uppercase tracking-wider">Suggested for you</h2>
        <Link href="/tracks" className="text-xs text-accent hover:underline">Browse all tracks →</Link>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {plans.slice(0, 3).map((plan) => (
          <a
            key={plan.slug}
            href={plan.github_url}
            target="_blank"
            rel="noopener noreferrer"
            className="block bg-surface border border-border rounded-xl p-4 hover:border-accent/40 transition-all no-underline group"
          >
            <div className="flex items-start gap-2 mb-2">
              <span className="text-sm font-semibold text-text group-hover:text-accent transition-colors flex-1 min-w-0">
                {plan.title || plan.slug}
              </span>
              {plan.type && (
                <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-accent/15 text-accent uppercase shrink-0">
                  {plan.type}
                </span>
              )}
            </div>
            <ul className="space-y-0.5">
              {plan.reasons.slice(0, 2).map((r, i) => (
                <li key={i} className="text-[11px] text-muted flex items-start gap-1">
                  <span className="text-saaf-green shrink-0">✓</span>
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </a>
        ))}
      </div>
    </div>
  );
}
