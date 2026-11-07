"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { UserProfile } from "@/types";
import { profileCompleteness } from "@/lib/profile-completeness";
import { TourShell } from "./TourShell";

const STORAGE_KEY = "saaf-onboarding-completed";

export default function OnboardingWizard({ profile }: { profile: UserProfile | null }) {
  const [show, setShow] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!profile) return;
    if (localStorage.getItem(STORAGE_KEY) === "true") return;
    // Only show if profile incomplete or no observability checks
    const completeness = profileCompleteness(profile);
    if (completeness.percent < 100) {
      setShow(true);
    } else {
      localStorage.setItem(STORAGE_KEY, "true");
    }
  }, [profile]);

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, "true");
    setShow(false);
  };

  const skip = () => setShow(false);

  if (!show || !profile) return null;

  const completeness = profileCompleteness(profile);

  const steps = [
    {
      title: "Welcome to SAAF Portal! 👋",
      content: (
        <div>
          <p className="text-muted text-sm mb-3">
            You&apos;re part of the <strong className="text-text">Shared Audit Agents Framework</strong> —
            organisations co-creating AI audit agents.
          </p>
          <p className="text-muted text-sm">
            Let&apos;s set you up in 3 quick steps so you can get the most out of the portal.
          </p>
        </div>
      ),
    },
    {
      title: "Step 1: Complete your profile",
      content: (
        <div>
          <p className="text-muted text-sm mb-3">
            Your profile is <strong className={completeness.percent < 100 ? "text-saaf-yellow" : "text-saaf-green"}>{completeness.percent}% complete</strong>.
            Filling it in helps the portal suggest the right plans and connect you with the right people.
          </p>
          {completeness.missing.length > 0 && (
            <div className="bg-bg border border-border rounded-lg p-3 mb-3">
              <div className="text-xs text-muted mb-1">Missing:</div>
              <div className="flex flex-wrap gap-1">
                {completeness.missing.map((m) => (
                  <span key={m.key} className="text-[11px] px-2 py-0.5 rounded bg-saaf-yellow/15 text-saaf-yellow">
                    {m.label}
                  </span>
                ))}
              </div>
            </div>
          )}
          <Link
            href="/profile"
            onClick={dismiss}
            className="inline-block px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg no-underline"
          >
            Go to profile →
          </Link>
        </div>
      ),
    },
    {
      title: "Step 2: Pick a plan",
      content: (
        <div>
          <p className="text-muted text-sm mb-3">
            Browse plans on the <strong className="text-text">Tracks</strong> page. Find one that matches
            your interest and read it. The portal will suggest plans based on your skills.
          </p>
          <Link
            href="/tracks"
            onClick={dismiss}
            className="inline-block px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg no-underline"
          >
            Explore tracks →
          </Link>
        </div>
      ),
    },
    {
      title: "Step 3: Submit observability checks",
      content: (
        <div>
          <p className="text-muted text-sm mb-3">
            For each plan you read, submit observability notes — purpose, workflow, failure modes, controls.
            Each check earns you progress toward badges.
          </p>
          <p className="text-muted text-sm mb-4">
            You&apos;re now set up! Explore the portal at your own pace.
          </p>
          <button
            onClick={dismiss}
            className="inline-block px-4 py-2 bg-saaf-green hover:opacity-90 text-bg text-sm font-semibold rounded-lg cursor-pointer"
          >
            Get started 🚀
          </button>
        </div>
      ),
    },
  ];

  // The card, progress bar and Back / Next / Skip are the shared guide (TourShell), the same one the visualisation tours use.
  return (
    <TourShell
      steps={steps.map((st) => ({ title: st.title, body: st.content }))}
      step={step}
      onStep={setStep}
      onClose={skip}
      labelId="onboarding-title"
    />
  );
}
