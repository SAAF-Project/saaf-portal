"use client";

import { useEffect, useState } from "react";
import type { Track, Plan, Submitter, UserProfile } from "@/types";
import PlanMarkdownViewer from "@/components/PlanMarkdownViewer";
import ObservabilityPanel from "@/components/ObservabilityPanel";
import Link from "next/link";
import { getUserPlans } from "@/lib/plan-match";

const TRACK_COLORS: Record<number, string> = {
  0: "from-saaf-orange/20 to-saaf-orange/5 border-saaf-orange/30",
  1: "from-accent/20 to-accent/5 border-accent/30",
  2: "from-saaf-green/20 to-saaf-green/5 border-saaf-green/30",
  3: "from-saaf-purple/20 to-saaf-purple/5 border-saaf-purple/30",
  4: "from-saaf-yellow/20 to-saaf-yellow/5 border-saaf-yellow/30",
  5: "from-saaf-red/20 to-saaf-red/5 border-saaf-red/30",
};

const TRACK_ACCENT: Record<number, string> = {
  0: "text-saaf-orange", 1: "text-accent", 2: "text-saaf-green",
  3: "text-saaf-purple", 4: "text-saaf-yellow", 5: "text-saaf-red",
};

const PDCA_STATUS: Record<string, { label: string; cls: string }> = {
  complete: { label: "Complete", cls: "bg-saaf-green/15 text-saaf-green" },
  in_progress: { label: "In Progress", cls: "bg-saaf-yellow/15 text-saaf-yellow" },
  not_started: { label: "Not Started", cls: "bg-border/50 text-muted" },
};

function PdcaPill({ phase, status }: { phase: string; status: string }) {
  const s = PDCA_STATUS[status] || PDCA_STATUS.not_started;
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${s.cls}`}>
      {phase}: {s.label}
    </span>
  );
}

function ExpandablePlan({
  plan,
  isYours,
}: {
  plan: Plan;
  isYours: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showObservability, setShowObservability] = useState(false);

  return (
    <div className={`border rounded-xl mb-2 transition-all ${isYours ? "border-saaf-green/40 bg-saaf-green/5" : "border-border bg-surface"}`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left p-3 flex items-start gap-3 cursor-pointer hover:bg-white/3 rounded-xl transition-colors"
      >
        <span className="mt-0.5 text-muted text-xs shrink-0">{expanded ? "▼" : "▶"}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2 flex-wrap">
            <span className={`font-semibold text-sm ${isYours ? "text-saaf-green" : "text-accent"}`}>
              {plan.title || plan.slug}
            </span>
            {isYours && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-saaf-green/20 text-saaf-green font-bold shrink-0">Your plan</span>
            )}
            {plan.type && (
              <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-accent/15 text-accent uppercase shrink-0">{plan.type}</span>
            )}
            {plan.claimed_by && (
              <span className="text-[10px] text-muted shrink-0" title={`Claimed by ${plan.claimed_by}`}>👤 {plan.claimed_by}</span>
            )}
          </div>
          <div className="flex gap-1 flex-wrap mt-1.5">
            {Object.entries(plan.pdca || {}).map(([phase, status]) => (
              <PdcaPill key={phase} phase={phase.charAt(0).toUpperCase() + phase.slice(1)} status={status} />
            ))}
          </div>
        </div>
        {plan.quality_score > 0 && (
          <span className="text-saaf-yellow text-xs shrink-0 mt-0.5">{"★".repeat(plan.quality_score)}</span>
        )}
      </button>

      {expanded && (
        <div className="border-t border-border">
          {/* Toolbar */}
          <div className="flex items-center gap-3 px-4 py-2 border-b border-border bg-surface2/30">
            <a href={plan.github_url} target="_blank" rel="noopener noreferrer" className="text-xs text-accent hover:underline">
              View on GitHub ↗
            </a>
            <div className="flex-1" />
            <button
              onClick={() => setShowObservability(!showObservability)}
              className={`text-xs px-3 py-1.5 rounded-lg font-semibold cursor-pointer transition-colors border ${
                showObservability
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-border text-muted hover:text-text hover:border-accent/30"
              }`}
            >
              {showObservability ? "Hide observability" : "Observability notes"}
            </button>
          </div>

          {/* Content: plan markdown + optionally observability side by side */}
          <div className={showObservability ? "grid grid-cols-1 lg:grid-cols-2" : ""}>
            <div className={showObservability ? "border-r border-border overflow-y-auto max-h-[600px]" : ""}>
              <PlanMarkdownViewer session={plan.session} slug={plan.slug} />
            </div>
            {showObservability && (
              <div className="overflow-y-auto max-h-[600px]">
                <ObservabilityPanel planSlug={plan.slug} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function TracksPage() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [submitters, setSubmitters] = useState<Submitter[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/data/tracks.json").then((r) => r.json()),
      fetch("/data/plans.json").then((r) => r.json()),
      fetch("/data/submitters.json").then((r) => r.json()),
      fetch("/api/profile").then((r) => r.json()),
    ]).then(([t, p, s, prof]) => {
      setTracks(t);
      setPlans(p);
      setSubmitters(s);
      setProfile(prof);
    });
  }, []);

  const userPlans = profile ? getUserPlans(plans, profile, submitters) : [];
  const userPlanSlugs = new Set(userPlans.map((p) => p.slug));
  const enrolledTrackId = profile?.preferredTrack;

  if (!tracks.length) {
    return <div className="text-muted text-center py-12">Loading...</div>;
  }

  return (
    <div>
      <h1 className="text-2xl font-extrabold mb-4">Tracks</h1>

      {/* Enrolled track banner */}
      {enrolledTrackId ? (
        (() => {
          const enrolled = tracks.find((t) =>
            String(t.id) === enrolledTrackId || enrolledTrackId.startsWith(String(t.id))
          );
          return enrolled ? (
            <div className="mb-5 p-4 bg-saaf-green/10 border border-saaf-green/30 rounded-xl flex items-center gap-3">
              <span className="text-xl">✓</span>
              <div>
                <div className="font-bold text-saaf-green text-sm">You are enrolled</div>
                <div className="text-text text-sm">Track {enrolledTrackId} — {enrolled.short_name}</div>
              </div>
              <Link href="/profile" className="ml-auto text-xs text-accent hover:underline no-underline">
                Change track →
              </Link>
            </div>
          ) : null;
        })()
      ) : (
        <div className="mb-5 p-4 bg-saaf-yellow/10 border border-saaf-yellow/30 rounded-xl flex items-center gap-3">
          <span className="text-lg">⚠</span>
          <div className="flex-1">
            <div className="font-semibold text-saaf-yellow text-sm">No track selected</div>
            <div className="text-muted text-xs">Update your profile to indicate which track you&apos;re working on.</div>
          </div>
          <Link href="/profile" className="text-xs px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium no-underline">
            Update profile
          </Link>
        </div>
      )}

      {/* My plans summary */}
      {userPlans.length > 0 && (
        <div className="mb-5 bg-surface border border-saaf-green/20 rounded-xl p-4">
          <h2 className="text-xs font-bold text-saaf-green uppercase tracking-wider mb-2">
            Your Plans ({userPlans.length})
          </h2>
          <div className="flex flex-wrap gap-2">
            {userPlans.map((plan) => (
              <a
                key={plan.slug}
                href={plan.github_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-saaf-green/10 border border-saaf-green/30 rounded-lg text-xs text-saaf-green font-medium hover:bg-saaf-green/20 no-underline transition-colors"
              >
                {plan.title || plan.slug}
                {plan.track !== null && (
                  <span className="opacity-60">· T{plan.track}</span>
                )}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Track cards */}
      {tracks.map((track) => {
        const trackPlans = plans.filter((p) => p.track === track.id);
        const isEnrolled = enrolledTrackId &&
          (String(track.id) === enrolledTrackId || enrolledTrackId.startsWith(String(track.id)));
        const colorClass = TRACK_COLORS[track.id] || "from-surface to-surface border-border";
        const accentClass = TRACK_ACCENT[track.id] || "text-text";

        return (
          <div
            key={track.id}
            id={`track-${track.id}`}
            className={`bg-gradient-to-br ${colorClass} border rounded-2xl p-5 mb-4 transition-all ${isEnrolled ? "ring-2 ring-saaf-green/50 shadow-lg shadow-saaf-green/5" : ""}`}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h3 className="text-lg font-bold">
                    Track {track.id}: {track.short_name}
                  </h3>
                  {isEnrolled && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-saaf-green/20 text-saaf-green font-bold">
                      Enrolled
                    </span>
                  )}
                </div>
                <p className="text-muted text-sm leading-snug">{track.mission}</p>
              </div>
              <span className={`text-5xl font-extrabold opacity-20 ${accentClass} ml-3`}>
                {track.id}
              </span>
            </div>

            <div className="flex gap-1.5 flex-wrap mb-4">
              {Object.entries(track.team).map(([role, count]) => (
                <span key={role} className="text-xs px-2.5 py-1 rounded-full bg-white/8 text-muted font-medium">
                  {count}× {role}
                </span>
              ))}
              <span className="text-xs px-2.5 py-1 rounded-full bg-white/8 text-muted font-medium">
                {trackPlans.length} plan{trackPlans.length !== 1 ? "s" : ""}
              </span>
            </div>

            {trackPlans.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Plans</h4>
                {trackPlans.map((plan) => (
                  <ExpandablePlan
                    key={plan.slug}
                    plan={plan}
                    isYours={userPlanSlugs.has(plan.slug)}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}

    </div>
  );
}
