"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function AboutSAAFSection() {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setDismissed(localStorage.getItem("saaf-about-dismissed") === "true");
  }, []);

  const dismiss = () => {
    localStorage.setItem("saaf-about-dismissed", "true");
    setDismissed(true);
  };

  if (dismissed) return null;

  return (
    <div className="mb-6 p-5 bg-gradient-to-br from-accent/10 to-saaf-purple/5 border border-accent/20 rounded-2xl relative">
      <button
        onClick={dismiss}
        className="absolute top-3 right-3 text-muted hover:text-text text-lg cursor-pointer"
        title="Dismiss"
      >
        ×
      </button>
      <h3 className="text-base font-bold mb-2">
        <span className="bg-gradient-to-r from-accent to-saaf-purple bg-clip-text text-transparent">
          What is SAAF?
        </span>
      </h3>
      <p className="text-sm text-muted leading-relaxed mb-3 max-w-3xl">
        The <strong className="text-text">Shared Audit Agents Framework</strong> brings 45+ organisations together
        to co-create AI agents for internal & IT audit. We build reusable components around four pillars
        — Prompts, Tools, Regulatory, and Outputs — across hackathons throughout 2026.
      </p>
      <Link
        href="/about"
        className="inline-flex items-center gap-1 text-sm text-accent font-semibold hover:underline no-underline"
      >
        Learn more about the project →
      </Link>
    </div>
  );
}
