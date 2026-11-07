"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { Identity } from "@/components/temple/ProgressApp";
import type { Submitter } from "@/components/temple/filters";
import type { ProgressData } from "@/components/temple/types";
import "@/components/temple/temple.css";
import { getUserPlans } from "@/lib/plan-match";
import type { Plan, UserProfile } from "@/types";

// The 3D scene only works in the browser.
const ProgressApp = dynamic(() => import("@/components/temple/ProgressApp").then((m) => m.ProgressApp), {
  ssr: false,
  loading: () => <div className="p-8 text-muted">Loading the temple...</div>,
});

interface Loaded {
  progress: ProgressData;
  submitters: Submitter[];
  source: "live" | "bundled";
  repo_checks: string | null; // when the repos were last checked on GitHub; null = no live repo alerts
}

// The portal switches themes with data-theme on <html> (see ThemeToggle); the temple follows it.
function subscribeTheme(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}
const currentTheme = () => (document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark");

export default function ProgressView() {
  const theme = useSyncExternalStore(subscribeTheme, currentTheme, () => "dark" as const);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/progress")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(setLoaded)
      .catch((e: Error) => setError(e.message));
    // who is signed in: their plans make up the personal view (without it the view offers a name picker)
    fetch("/api/profile")
      .then((r) => (r.ok ? r.json() : null))
      .then(setProfile)
      .catch(() => setProfile(null));
  }, []);

  // Same matching as the Tracks page: the submitters list plus plans the person claimed.
  const identity = useMemo<Identity | null>(() => {
    if (!loaded || !profile) return null;
    const owned = getUserPlans(loaded.progress.plans as unknown as Plan[], profile, loaded.submitters);
    return { name: profile.name || profile.githubUsername, owned: owned.map((p) => p.slug) };
  }, [loaded, profile]);

  if (error) return <div className="p-8 text-saaf-red">Could not load the progress data ({error}).</div>;
  if (!loaded) return <div className="p-8 text-muted">Loading progress data...</div>;

  return (
    <div className="relative h-full w-full">
      <ProgressApp data={loaded.progress} submitters={loaded.submitters} identity={identity} theme={theme} assetBase="/" />
      {(loaded.source === "bundled" || !loaded.repo_checks) && (
        <div className="pointer-events-none absolute bottom-[62px] left-4 z-[60] rounded bg-surface/80 px-2 py-1 text-[11px] text-muted">
          {loaded.source === "bundled" && "Showing the copy bundled with the portal: the live data could not be fetched. "}
          {!loaded.repo_checks && "Repo checks (AUDIT-CRITERIA.md, tests, activity) are unavailable: GitHub did not answer."}
        </div>
      )}
    </div>
  );
}
