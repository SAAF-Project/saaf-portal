"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import Link from "next/link";
import UserAvatar from "@/components/UserAvatar";
import ActivityFeed from "@/components/ActivityFeed";
import AchievementBadge from "@/components/AchievementBadge";
import { getUserPlans } from "@/lib/plan-match";
import type { ScoreEntry, ActivityEntry, Plan, Submitter, Achievement, UserProfile } from "@/types";

export default function DashboardPage() {
  const { data: session } = useSession();
  const [leaderboard, setLeaderboard] = useState<{
    scores: ScoreEntry[];
    activity: ActivityEntry[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [myPlans, setMyPlans] = useState<Plan[]>([]);
  const [achievement, setAchievement] = useState<Achievement | null>(null);

  const username = (session?.user as { githubUsername?: string })?.githubUsername;

  useEffect(() => {
    const loadAll = async () => {
      const [lb, plans, submitters, prof, ach] = await Promise.all([
        fetch("/api/leaderboard?filter=all").then((r) => r.json()).catch(() => null),
        fetch("/data/plans.json").then((r) => r.json()).catch(() => []),
        fetch("/data/submitters.json").then((r) => r.json()).catch(() => []),
        fetch("/api/profile").then((r) => r.json()).catch(() => null),
        fetch("/api/achievements").then((r) => r.json()).catch(() => null),
      ]);
      setLeaderboard(lb);
      setAchievement(ach);
      if (prof) {
        setMyPlans(getUserPlans(plans as Plan[], prof as UserProfile, submitters as Submitter[]));
      }
      setLoading(false);
    };
    loadAll();
  }, []);

  const myScore = leaderboard?.scores.find((s) => s.login === username);
  const myRank = leaderboard?.scores.findIndex((s) => s.login === username);

  const quickLinks = [
    { href: "/profile", label: "Profile", desc: "View & edit your profile", icon: "●" },
    { href: "/participants", label: "Participants", desc: "See all members and their skills", icon: "👥" },
    { href: "/tracks", label: "Tracks", desc: "Explore tracks & submit observability checks", icon: "▶" },
    { href: "/my-repos", label: "My Repos", desc: "Your org repositories", icon: "◇" },
  ];

  return (
    <div>
      {/* Greeting */}
      <div className="flex items-center gap-4 mb-6">
        <UserAvatar src={session?.user?.image} alt={session?.user?.name || username} size={56} />
        <div className="flex-1">
          <h1 className="text-2xl font-extrabold">
            Welcome back, {session?.user?.name || username}
          </h1>
          <p className="text-muted text-sm">@{username}</p>
        </div>
        {achievement && (
          <div className="flex flex-wrap gap-1.5 max-w-md justify-end">
            {achievement.badges
              .filter((b) => b.level > 0)
              .map((badge) => (
                <AchievementBadge key={badge.key} badge={badge} compact />
              ))}
          </div>
        )}
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="text-muted text-xs font-medium mb-1">Score</div>
          <div className="text-2xl font-black">{loading ? "..." : myScore?.total ?? 0}</div>
        </div>
        <div className="bg-surface border border-border rounded-xl p-4 relative">
          <div className="text-muted text-xs font-medium mb-1">Rank</div>
          <div className="text-2xl font-black">
            {loading ? "..." : myRank !== undefined && myRank >= 0 ? `#${myRank + 1}` : "-"}
          </div>
          <Link href="/leaderboard" className="absolute bottom-3 right-3 text-[10px] text-accent hover:underline no-underline">
            Leaderboard →
          </Link>
        </div>
        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="text-muted text-xs font-medium mb-1">Merged PRs</div>
          <div className="text-2xl font-black">{loading ? "..." : myScore?.prs ?? 0}</div>
        </div>
        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="text-muted text-xs font-medium mb-1">Observability checks</div>
          <div className="text-2xl font-black">{loading ? "..." : achievement?.badges.find((b) => b.key === "observability")?.count ?? 0}</div>
          <div className="text-[10px] text-muted mt-0.5">submitted via Tracks</div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-6">
        {/* Quick links */}
        <div>
          <h2 className="text-xs font-bold text-muted uppercase tracking-wider mb-3">Quick links</h2>
          <div className="space-y-2">
            {quickLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="block bg-surface border border-border rounded-xl p-4 hover:border-accent/30 transition-all no-underline group"
              >
                <div className="flex items-center gap-3">
                  <span className="text-accent text-lg opacity-50">{link.icon}</span>
                  <div>
                    <div className="font-semibold text-sm group-hover:text-accent transition-colors">{link.label}</div>
                    <div className="text-muted text-xs">{link.desc}</div>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          <div className="mt-3 space-y-2">
            {[
              { href: "/e-learning", icon: "▣", label: "E-Learning", desc: "Interactive learning modules" },
              { href: "/agent-library", icon: "◈", label: "Agent Library", desc: "Browse community AI audit agents" },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="block bg-surface border border-border rounded-xl p-4 opacity-60 no-underline"
              >
                <div className="flex items-center gap-3">
                  <span className="text-accent text-lg opacity-50">{item.icon}</span>
                  <div>
                    <div className="font-semibold text-sm">
                      {item.label} <span className="text-xs text-accent font-normal ml-1">coming soon</span>
                    </div>
                    <div className="text-muted text-xs">{item.desc}</div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Recent activity */}
        <div>
          <h2 className="text-xs font-bold text-muted uppercase tracking-wider mb-3">Recent activity</h2>
          {loading ? (
            <div className="text-muted text-sm p-6 text-center">Loading...</div>
          ) : (
            <ActivityFeed entries={leaderboard?.activity.slice(0, 8) || []} />
          )}
        </div>
      </div>

      {/* My Plans — at the bottom */}
      {!loading && myPlans.length > 0 && (
        <div className="bg-surface border border-saaf-green/20 rounded-xl p-4">
          <h2 className="text-xs font-bold text-saaf-green uppercase tracking-wider mb-3">
            My Plans ({myPlans.length})
          </h2>
          <div className="space-y-2">
            {myPlans.map((plan) => (
              <div key={plan.slug} className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <a
                    href={plan.github_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-accent hover:underline block truncate"
                  >
                    {plan.title || plan.slug}
                  </a>
                  <div className="flex gap-1.5 mt-0.5 flex-wrap">
                    {plan.type && (
                      <span className="text-[10px] px-1 py-0.5 rounded bg-accent/10 text-accent font-semibold">{plan.type}</span>
                    )}
                    {Object.entries(plan.pdca || {}).map(([phase, status]) => {
                      const cls = status === "complete" ? "text-saaf-green" : status === "in_progress" ? "text-saaf-yellow" : "text-muted";
                      return (
                        <span key={phase} className={`text-[10px] ${cls}`}>
                          {phase.charAt(0).toUpperCase()}: {status === "complete" ? "✓" : status === "in_progress" ? "..." : "○"}
                        </span>
                      );
                    })}
                  </div>
                </div>
                <Link href="/tracks" className="text-xs text-muted hover:text-accent no-underline shrink-0">
                  View in Tracks →
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
