"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { SuggestedPlanWithReasons, UserProfile } from "@/types";
import { profileCompleteness } from "@/lib/profile-completeness";

export default function SuggestedPlans() {
  const [plans, setPlans] = useState<SuggestedPlanWithReasons[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    Promise.allSettled([
      fetch("/api/suggestions").then((r) => r.json()),
      fetch("/api/profile").then((r) => r.json()),
    ]).then(([sR, pR]) => {
      const s = sR.status === "fulfilled" ? sR.value : null;
      const p = pR.status === "fulfilled" ? pR.value : null;
      if (Array.isArray(s)) setPlans(s);
      if (p && !p.error) setProfile(p);
      if (sR.status === "rejected" && pR.status === "rejected") setError(true);
      setLoading(false);
    });
  }, []);

  if (loading) return null;
  if (error) {
    return (
      <div className="mb-6 p-3 bg-saaf-yellow/5 border border-saaf-yellow/20 rounded-xl text-xs text-muted">
        Couldn&apos;t load suggestions — refresh to try again.
      </div>
    );
  }
  if (plans.length === 0 && !profile) return null;

  const completeness = profile ? profileCompleteness(profile) : null;
  const profileIncomplete = completeness && completeness.percent < 100;

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-bold text-muted uppercase tracking-wider">Suggested for you</h2>
        <Link href="/tracks" className="text-xs text-accent hover:underline">Browse all tracks →</Link>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {/* First 2 plans */}
        {plans.slice(0, 2).map((plan) => (
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

        {/* Profile reminder card — always shown, color-coded by completeness */}
        {profile && (
          <Link
            href="/profile"
            className={`block border rounded-xl p-4 transition-all no-underline group ${
              profileIncomplete
                ? "bg-saaf-yellow/5 border-saaf-yellow/30 hover:border-saaf-yellow/50"
                : "bg-surface border-border hover:border-accent/40"
            }`}
          >
            <div className="flex items-start gap-2 mb-2">
              <span className={`text-sm font-semibold transition-colors flex-1 min-w-0 ${
                profileIncomplete ? "text-saaf-yellow" : "text-text group-hover:text-accent"
              }`}>
                {profileIncomplete ? "Complete your profile" : "Keep your profile fresh"}
              </span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase shrink-0 ${
                profileIncomplete ? "bg-saaf-yellow/20 text-saaf-yellow" : "bg-accent/15 text-accent"
              }`}>
                You
              </span>
            </div>
            <ul className="space-y-0.5">
              {profileIncomplete ? (
                <>
                  <li className="text-[11px] text-muted flex items-start gap-1">
                    <span className="text-saaf-yellow shrink-0">!</span>
                    <span>{completeness.percent}% complete — missing {completeness.missing.map(m => m.label).join(", ")}</span>
                  </li>
                  <li className="text-[11px] text-muted flex items-start gap-1">
                    <span className="text-saaf-green shrink-0">✓</span>
                    <span>Better suggestions when filled</span>
                  </li>
                </>
              ) : (
                <>
                  <li className="text-[11px] text-muted flex items-start gap-1">
                    <span className="text-saaf-green shrink-0">✓</span>
                    <span>Update your skills as you learn</span>
                  </li>
                  <li className="text-[11px] text-muted flex items-start gap-1">
                    <span className="text-saaf-green shrink-0">✓</span>
                    <span>Adjust your track if you switch focus</span>
                  </li>
                </>
              )}
            </ul>
          </Link>
        )}
      </div>
    </div>
  );
}
