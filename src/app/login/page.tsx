"use client";

import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { useState, Suspense } from "react";
import Image from "next/image";

function LoginForm() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const isNotMember = error === "not-member";

  const [showSignup, setShowSignup] = useState(isNotMember);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          githubUsername: username.replace("@", "").trim(),
          email: email.trim() || undefined,
        }),
      });
      if (res.ok) setSubmitted(true);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <Image
            src="/saaf-logo-white.png"
            alt="SAAF"
            width={200}
            height={60}
            className="mx-auto mb-6"
            style={{ width: "200px", height: "auto" }}
            priority
          />
          <h1 className="text-3xl font-extrabold mb-2">SAAF Portal</h1>
          <p className="text-muted text-sm">
            Participant portal for the Shared Audit Agents Framework
          </p>
        </div>

        {!showSignup ? (
          <div className="bg-surface border border-border rounded-2xl p-8">
            <button
              onClick={() => signIn("github", { callbackUrl: "/dashboard" })}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-6 rounded-xl transition-all shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-3 cursor-pointer"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
              </svg>
              Sign in with GitHub
            </button>

            <p className="text-muted text-xs text-center mt-4">
              You must be a member of the SAAF-Project GitHub organization.
            </p>

            {error && !isNotMember && (
              <div className="mt-4 p-3 bg-saaf-red/10 border border-saaf-red/30 rounded-lg text-sm text-saaf-red">
                Authentication failed. Please try again.
              </div>
            )}

            {isNotMember && (
              <div className="mt-4 p-3 bg-saaf-yellow/10 border border-saaf-yellow/30 rounded-lg text-sm">
                <p className="text-saaf-yellow font-semibold mb-1">
                  Not a member yet
                </p>
                <p className="text-muted text-xs">
                  Your GitHub account is not part of the SAAF-Project
                  organization.
                </p>
                <button
                  onClick={() => setShowSignup(true)}
                  className="mt-2 text-accent text-xs font-medium hover:underline cursor-pointer"
                >
                  Request access →
                </button>
              </div>
            )}
          </div>
        ) : submitted ? (
          <div className="bg-surface border border-border rounded-2xl p-8 text-center">
            <div className="text-4xl mb-4">✓</div>
            <h2 className="text-xl font-bold mb-2">Request received</h2>
            <p className="text-muted text-sm">
              You will receive a GitHub organization invitation once your request
              has been approved. After accepting it, come back and sign in.
            </p>
            <button
              onClick={() => {
                setShowSignup(false);
                setSubmitted(false);
              }}
              className="mt-6 text-accent text-sm hover:underline cursor-pointer"
            >
              ← Back to sign in
            </button>
          </div>
        ) : (
          <div className="bg-surface border border-border rounded-2xl p-8">
            <h2 className="text-lg font-bold mb-1">Request access</h2>
            <p className="text-muted text-xs mb-4">
              Enter your GitHub username to request an invitation to the
              SAAF-Project organization.
            </p>

            <div className="mb-4 p-3 bg-saaf-yellow/5 border border-saaf-yellow/20 rounded-lg text-xs text-muted leading-relaxed">
              <p className="text-saaf-yellow font-semibold mb-1">Disclaimer</p>
              <p>
                SAAF Project repos are currently private. We cannot provide
                assurance on the AI agents in this repository — AI LLMs can
                hallucinate and we have not yet completed the red-teaming (hack
                the agents) phase. Agents are shared as-is for research and
                collaboration purposes only.
              </p>
              <p className="mt-2">
                This gives you access to the repository only, not to physical
                SAAF sessions.
              </p>
            </div>

            <form onSubmit={handleSignup}>
              <div className="mb-3">
                <label className="block text-xs text-muted font-medium mb-1">
                  GitHub username *
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="@username"
                  required
                  className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm text-text focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30"
                />
              </div>
              <div className="mb-4">
                <label className="block text-xs text-muted font-medium mb-1">
                  Email (optional)
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm text-text focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30"
                />
              </div>
              <button
                type="submit"
                disabled={submitting || !username.trim()}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold py-2.5 px-6 rounded-xl transition-all cursor-pointer"
              >
                {submitting ? "Submitting..." : "Request access"}
              </button>
            </form>
            <button
              onClick={() => setShowSignup(false)}
              className="mt-4 text-muted text-xs hover:text-text block mx-auto cursor-pointer"
            >
              ← Back to sign in
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
