"use client";

import { useEffect, useState } from "react";
import type { ActivityStats } from "@/types";

export default function ActivityStatsBanner() {
  const [stats, setStats] = useState<ActivityStats | null>(null);

  useEffect(() => {
    fetch("/api/activity-stats")
      .then((r) => r.json())
      .then((d) => { if (!d.error) setStats(d); })
      .catch(() => {});
  }, []);

  if (!stats) return null;

  const items = [
    { value: stats.mergedPRs, label: "PRs merged", color: "text-saaf-green" },
    { value: stats.newPlans, label: "new plans", color: "text-accent" },
    { value: stats.observabilityChecks, label: "observability checks", color: "text-saaf-purple" },
    { value: stats.contributorCount, label: "active contributors", color: "text-saaf-yellow" },
  ];

  return (
    <div className="mb-6 p-3 px-4 bg-surface border border-border rounded-xl flex items-center gap-4 text-sm flex-wrap">
      <span className="text-xs text-muted font-bold uppercase tracking-wider">📊 Last 7 days</span>
      <div className="flex items-center gap-4 flex-wrap">
        {items.map((item, i) => (
          <span key={i} className="flex items-center gap-1.5">
            <strong className={`text-base font-black ${item.color}`}>{item.value}</strong>
            <span className="text-muted text-xs">{item.label}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
