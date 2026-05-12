"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import Link from "next/link";
import UserAvatar from "@/components/UserAvatar";
import ActivityFeed from "@/components/ActivityFeed";
import type { ScoreEntry, ActivityEntry } from "@/types";

export default function DashboardPage() {
  const { data: session } = useSession();
  const [leaderboard, setLeaderboard] = useState<{
    scores: ScoreEntry[];
    activity: ActivityEntry[];
    stats: { contributors: number; mergedPRs: number; planFilesTouched: number; totalPlans: number };
  } | null>(null);
  const [loading, setLoading] = useState(true);

  const username = (session?.user as { githubUsername?: string })?.githubUsername;

  useEffect(() => {
    fetch("/api/leaderboard?filter=all")
      .then((r) => r.json())
      .then(setLeaderboard)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const myScore = leaderboard?.scores.find((s) => s.login === username);
  const myRank = leaderboard?.scores.findIndex((s) => s.login === username);

  const quickLinks = [
    { href: "/profile", label: "Profile", desc: "View & edit your profile", icon: "●" },
    { href: "/leaderboard", label: "Leaderboard", desc: "See who's contributing", icon: "★" },
    { href: "/tracks", label: "Tracks", desc: "Explore the 6 tracks", icon: "▶" },
    { href: "/my-repos", label: "My Repos", desc: "Your org repositories", icon: "◇" },
  ];

  return (
    <div>
      {/* Greeting */}
      <div className="flex items-center gap-4 mb-8">
        <UserAvatar
          src={session?.user?.image}
          alt={session?.user?.name || username}
          size={56}
        />
        <div>
          <h1 className="text-2xl font-extrabold">
            Welcome back, {session?.user?.name || username}
          </h1>
          <p className="text-muted text-sm">@{username}</p>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="text-muted text-xs font-medium mb-1">Your Score</div>
          <div className="text-2xl font-black">
            {loading ? "..." : myScore?.total ?? 0}
          </div>
        </div>
        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="text-muted text-xs font-medium mb-1">Your Rank</div>
          <div className="text-2xl font-black">
            {loading ? "..." : myRank !== undefined && myRank >= 0 ? `#${myRank + 1}` : "-"}
          </div>
        </div>
        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="text-muted text-xs font-medium mb-1">Merged PRs</div>
          <div className="text-2xl font-black">
            {loading ? "..." : myScore?.prs ?? 0}
          </div>
        </div>
        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="text-muted text-xs font-medium mb-1">Plans</div>
          <div className="text-2xl font-black">
            {loading ? "..." : myScore ? myScore.newPlans + myScore.updateCount : 0}
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Quick links */}
        <div>
          <h2 className="text-xs font-bold text-muted uppercase tracking-wider mb-3">
            Quick links
          </h2>
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
                    <div className="font-semibold text-sm group-hover:text-accent transition-colors">
                      {link.label}
                    </div>
                    <div className="text-muted text-xs">{link.desc}</div>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {/* Coming soon teasers */}
          <div className="mt-4 space-y-2">
            <Link
              href="/e-learning"
              className="block bg-surface border border-border rounded-xl p-4 opacity-60 no-underline"
            >
              <div className="flex items-center gap-3">
                <span className="text-accent text-lg opacity-50">▣</span>
                <div>
                  <div className="font-semibold text-sm">
                    E-Learning{" "}
                    <span className="text-xs text-accent font-normal ml-1">
                      coming soon
                    </span>
                  </div>
                  <div className="text-muted text-xs">
                    Interactive learning modules
                  </div>
                </div>
              </div>
            </Link>
            <Link
              href="/agent-library"
              className="block bg-surface border border-border rounded-xl p-4 opacity-60 no-underline"
            >
              <div className="flex items-center gap-3">
                <span className="text-accent text-lg opacity-50">◈</span>
                <div>
                  <div className="font-semibold text-sm">
                    Agent Library{" "}
                    <span className="text-xs text-accent font-normal ml-1">
                      coming soon
                    </span>
                  </div>
                  <div className="text-muted text-xs">
                    Browse community AI audit agents
                  </div>
                </div>
              </div>
            </Link>
          </div>
        </div>

        {/* Recent activity */}
        <div>
          <h2 className="text-xs font-bold text-muted uppercase tracking-wider mb-3">
            Recent activity
          </h2>
          {loading ? (
            <div className="text-muted text-sm p-6 text-center">Loading...</div>
          ) : (
            <ActivityFeed entries={leaderboard?.activity.slice(0, 8) || []} />
          )}
        </div>
      </div>
    </div>
  );
}
