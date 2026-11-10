"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

interface SignupRequest {
  id: string;
  githubUsername: string;
  email: string | null;
  status: string;
  createdAt: string;
  processedAt: string | null;
}

interface FeedbackItem {
  id: string;
  category: string | null;
  text: string;
  status: string;
  createdAt: string;
  user: { name: string | null; githubUsername: string; avatarUrl: string | null; organisation: string | null };
}

const CATEGORY_LABELS: Record<string, string> = {
  portal: "Portal",
  "saaf-project": "SAAF Project",
  bug: "Bug",
  feature: "Feature",
  general: "General",
};

const CATEGORY_COLORS: Record<string, string> = {
  portal: "bg-accent/15 text-accent",
  "saaf-project": "bg-saaf-purple/15 text-saaf-purple",
  bug: "bg-saaf-red/15 text-saaf-red",
  feature: "bg-saaf-green/15 text-saaf-green",
  general: "bg-muted/15 text-muted",
};

export default function AdminPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [tab, setTab] = useState<"signups" | "feedback" | "quiz" | "demos" | "pizza">("signups");
  const [requests, setRequests] = useState<SignupRequest[]>([]);
  const [feedback, setFeedback] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const username = (session?.user as { githubUsername?: string })?.githubUsername;

  useEffect(() => {
    if (!session) return; // wait for session before deciding
    if (username !== "MSACC") {
      router.push("/dashboard");
      return;
    }

    Promise.all([
      fetch("/api/admin/signups").then((r) => r.ok ? r.json() : []).catch(() => []),
      fetch("/api/admin/feedback").then((r) => r.ok ? r.json() : []).catch(() => []),
    ])
      .then(([sig, fb]) => {
        setRequests(Array.isArray(sig) ? sig : []);
        setFeedback(Array.isArray(fb) ? fb : []);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [session, username, router]);

  const updateFeedbackStatus = async (id: string, status: string) => {
    await fetch("/api/admin/feedback", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    setFeedback((prev) => prev.map((f) => (f.id === id ? { ...f, status } : f)));
  };

  const pendingSignups = requests.filter((r) => r.status === "pending");
  const newFeedback = feedback.filter((f) => f.status === "new");

  // Don't render anything until we know if user is admin (avoids brief loading state for non-admins)
  if (!session || username !== "MSACC") return null;
  if (loading) return <div className="text-muted text-center py-12">Loading...</div>;
  if (error) return <div className="text-saaf-red text-center py-12">Access denied</div>;

  return (
    <div>
      <h1 className="text-2xl font-extrabold mb-4">Admin</h1>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border mb-6">
        <button
          onClick={() => setTab("signups")}
          className={`px-4 py-2 text-sm font-semibold cursor-pointer transition-colors border-b-2 ${
            tab === "signups" ? "text-accent border-accent" : "text-muted border-transparent hover:text-text"
          }`}
        >
          Signup Requests
          {pendingSignups.length > 0 && (
            <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full bg-saaf-yellow/20 text-saaf-yellow">
              {pendingSignups.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab("feedback")}
          className={`px-4 py-2 text-sm font-semibold cursor-pointer transition-colors border-b-2 ${
            tab === "feedback" ? "text-accent border-accent" : "text-muted border-transparent hover:text-text"
          }`}
        >
          Feedback
          {newFeedback.length > 0 && (
            <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full bg-saaf-yellow/20 text-saaf-yellow">
              {newFeedback.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab("quiz")}
          className={`px-4 py-2 text-sm font-semibold cursor-pointer transition-colors border-b-2 ${
            tab === "quiz" ? "text-accent border-accent" : "text-muted border-transparent hover:text-text"
          }`}
        >
          Quiz
        </button>
        <button
          onClick={() => setTab("demos")}
          className={`px-4 py-2 text-sm font-semibold cursor-pointer transition-colors border-b-2 ${
            tab === "demos" ? "text-accent border-accent" : "text-muted border-transparent hover:text-text"
          }`}
        >
          Demos
        </button>
        <button
          onClick={() => setTab("pizza")}
          className={`px-4 py-2 text-sm font-semibold cursor-pointer transition-colors border-b-2 ${
            tab === "pizza" ? "text-accent border-accent" : "text-muted border-transparent hover:text-text"
          }`}
        >
          Pizza
        </button>
      </div>

      {tab === "quiz" && <QuizTab />}
      {tab === "demos" && <DemosTab />}
      {tab === "pizza" && <PizzaTab />}

      {tab === "signups" && (
        <SignupsTab requests={requests} pendingCount={pendingSignups.length} />
      )}

      {tab === "feedback" && (
        <FeedbackTab feedback={feedback} updateStatus={updateFeedbackStatus} />
      )}
    </div>
  );
}

function SignupsTab({ requests, pendingCount }: { requests: SignupRequest[]; pendingCount: number }) {
  const pending = requests.filter((r) => r.status === "pending");
  const processed = requests.filter((r) => r.status !== "pending");

  return (
    <>
      <div className="bg-surface border border-border rounded-xl p-4 mb-6 flex items-center gap-4">
        <div className="text-3xl font-black text-saaf-yellow">{pendingCount}</div>
        <div>
          <div className="font-semibold text-sm">Pending requests</div>
          <p className="text-muted text-xs">
            Process via: <code className="bg-surface2 px-1.5 py-0.5 rounded text-[11px]">npx tsx scripts/process-signups.ts --prod</code>
          </p>
        </div>
      </div>

      {pending.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xs font-bold text-muted uppercase tracking-wider mb-3">Pending</h2>
          <div className="bg-surface border border-border rounded-xl overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted">
                  <th className="px-4 py-3 font-medium">GitHub username</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Requested</th>
                </tr>
              </thead>
              <tbody>
                {pending.map((req) => (
                  <tr key={req.id} className="border-b border-border">
                    <td className="px-4 py-3 font-semibold">@{req.githubUsername}</td>
                    <td className="px-4 py-3 text-muted">{req.email || "—"}</td>
                    <td className="px-4 py-3"><StatusBadge status={req.status} /></td>
                    <td className="px-4 py-3 text-muted text-xs">{new Date(req.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {processed.length > 0 && (
        <div>
          <h2 className="text-xs font-bold text-muted uppercase tracking-wider mb-3">
            Processed ({processed.length})
          </h2>
          <div className="bg-surface border border-border rounded-xl overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted">
                  <th className="px-4 py-3 font-medium">GitHub username</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Requested</th>
                  <th className="px-4 py-3 font-medium">Processed</th>
                </tr>
              </thead>
              <tbody>
                {processed.map((req) => (
                  <tr key={req.id} className="border-b border-border opacity-70">
                    <td className="px-4 py-3 font-semibold">@{req.githubUsername}</td>
                    <td className="px-4 py-3 text-muted">{req.email || "—"}</td>
                    <td className="px-4 py-3"><StatusBadge status={req.status} /></td>
                    <td className="px-4 py-3 text-muted text-xs">{new Date(req.createdAt).toLocaleString()}</td>
                    <td className="px-4 py-3 text-muted text-xs">
                      {req.processedAt ? new Date(req.processedAt).toLocaleString() : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {requests.length === 0 && (
        <div className="bg-surface border border-border rounded-xl p-8 text-center">
          <p className="text-muted text-sm">No signup requests yet.</p>
        </div>
      )}
    </>
  );
}

function FeedbackTab({
  feedback,
  updateStatus,
}: {
  feedback: FeedbackItem[];
  updateStatus: (id: string, status: string) => void;
}) {
  if (feedback.length === 0) {
    return (
      <div className="bg-surface border border-border rounded-xl p-8 text-center">
        <p className="text-muted text-sm">No feedback yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {feedback.map((f) => (
        <div key={f.id} className={`bg-surface border rounded-xl p-4 ${f.status === "new" ? "border-accent/30" : "border-border opacity-70"}`}>
          <div className="flex items-start gap-3 mb-3">
            <img
              src={f.user.avatarUrl || `https://github.com/${f.user.githubUsername}.png?size=64`}
              alt=""
              className="w-9 h-9 rounded-full border border-border shrink-0"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-sm">{f.user.name || f.user.githubUsername}</span>
                <span className="text-muted text-xs">@{f.user.githubUsername}</span>
                {f.user.organisation && <span className="text-muted text-xs">· {f.user.organisation}</span>}
              </div>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {f.category && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${CATEGORY_COLORS[f.category]}`}>
                    {CATEGORY_LABELS[f.category]}
                  </span>
                )}
                <span className="text-[11px] text-muted">{new Date(f.createdAt).toLocaleString()}</span>
                <FeedbackStatusBadge status={f.status} />
              </div>
            </div>
            <select
              value={f.status}
              onChange={(e) => updateStatus(f.id, e.target.value)}
              className="text-xs px-2 py-1 bg-bg border border-border rounded-lg text-text focus:outline-none focus:border-accent"
            >
              <option value="new">New</option>
              <option value="reviewed">Reviewed</option>
              <option value="resolved">Resolved</option>
            </select>
          </div>
          <p className="text-sm text-text whitespace-pre-wrap leading-relaxed">{f.text}</p>
        </div>
      ))}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles =
    status === "pending" ? "bg-saaf-yellow/15 text-saaf-yellow"
    : status === "approved" ? "bg-saaf-green/15 text-saaf-green"
    : "bg-saaf-red/15 text-saaf-red";
  return <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${styles}`}>{status}</span>;
}

function FeedbackStatusBadge({ status }: { status: string }) {
  const styles =
    status === "new" ? "bg-accent/15 text-accent"
    : status === "reviewed" ? "bg-saaf-yellow/15 text-saaf-yellow"
    : "bg-saaf-green/15 text-saaf-green";
  return <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${styles}`}>{status}</span>;
}

interface QuizGuess {
  githubUsername: string;
  name: string | null;
  organisation: string | null;
  guess: number;
  createdAt: string;
}

function QuizTab() {
  const [guesses, setGuesses] = useState<QuizGuess[] | null>(null);
  const [answer, setAnswer] = useState("");

  const load = () => {
    fetch("/api/quiz?format=json")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setGuesses(Array.isArray(d) ? d : []))
      .catch(() => setGuesses([]));
  };

  useEffect(() => {
    let active = true;
    fetch("/api/quiz?format=json")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => {
        if (active) setGuesses(Array.isArray(d) ? d : []);
      })
      .catch(() => active && setGuesses([]));
    return () => {
      active = false;
    };
  }, []);

  if (guesses === null) return <div className="text-muted text-center py-12">Loading...</div>;

  const total = answer.trim() === "" ? null : Number(answer);
  const ranked = [...guesses]
    .map((g) => ({ ...g, off: total === null || Number.isNaN(total) ? null : Math.abs(g.guess - total) }))
    .sort((a, b) => (a.off === null || b.off === null ? a.guess - b.guess : a.off - b.off || a.createdAt.localeCompare(b.createdAt)));

  return (
    <>
      <div className="bg-surface border border-border rounded-xl p-4 mb-6 flex flex-wrap items-center gap-4">
        <div className="text-3xl font-black text-accent">{guesses.length}</div>
        <div className="flex-1 min-w-[200px]">
          <div className="font-semibold text-sm">Guesses for the 10 November quiz</div>
          <p className="text-muted text-xs">Enter the distinct total from the tally to rank by closest guess. Ties go to the earliest guess.</p>
        </div>
        <input
          type="number"
          inputMode="numeric"
          placeholder="Actual total"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          className="w-36 bg-bg border border-border rounded-lg px-3 py-2 text-sm"
        />
        <button onClick={load} className="text-xs px-3 py-2 rounded-lg border border-border hover:border-accent cursor-pointer">
          Refresh
        </button>
        <a href="/api/quiz?format=csv" className="text-xs px-3 py-2 rounded-lg border border-border hover:border-accent no-underline">
          Download CSV
        </a>
      </div>

      {guesses.length === 0 ? (
        <div className="bg-surface border border-border rounded-xl p-8 text-center">
          <p className="text-muted text-sm">No guesses yet.</p>
        </div>
      ) : (
        <div className="bg-surface border border-border rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted">
                <th className="px-4 py-3 font-medium">#</th>
                <th className="px-4 py-3 font-medium">Member</th>
                <th className="px-4 py-3 font-medium">Organisation</th>
                <th className="px-4 py-3 font-medium text-right">Guess</th>
                <th className="px-4 py-3 font-medium text-right">Off by</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((g, i) => (
                <tr key={g.githubUsername} className={`border-b border-border ${g.off !== null && i < 3 ? "font-semibold" : ""}`}>
                  <td className="px-4 py-3 text-muted">{i + 1}</td>
                  <td className="px-4 py-3">
                    {g.name || g.githubUsername} <span className="text-muted text-xs">@{g.githubUsername}</span>
                  </td>
                  <td className="px-4 py-3 text-muted">{g.organisation || "—"}</td>
                  <td className="px-4 py-3 text-right font-mono">{g.guess}</td>
                  <td className="px-4 py-3 text-right font-mono">{g.off === null ? "—" : g.off}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

interface DemoTeamAdmin {
  id: string;
  team: string;
  title: string;
  what?: string;
  why?: string;
  repo: string;
  githubUsername: string;
  name?: string | null;
  organisation?: string | null;
  start?: string;
  end?: string;
}

interface DemoAdminState {
  drawn: boolean;
  secondsPerTeam: number;
  teams: DemoTeamAdmin[];
  schedule: DemoTeamAdmin[] | null;
}

function DemosTab() {
  const [state, setState] = useState<DemoAdminState | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    fetch("/api/demo")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setState(d))
      .catch(() => setState(null));
  };

  useEffect(() => {
    let active = true;
    fetch("/api/demo")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (active) setState(d);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const draw = async () => {
    setError(null);
    const res = await fetch("/api/demo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "draw" }),
    });
    if (!res.ok) setError((await res.json().catch(() => ({}))).error || "Draw failed");
    setConfirm(false);
    load();
  };
  const clearDraw = async () => {
    await fetch("/api/demo?draw=clear", { method: "DELETE" });
    load();
  };
  const remove = async (id: string) => {
    await fetch(`/api/demo?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    load();
  };

  if (state === null) return <div className="text-muted text-center py-12">Loading...</div>;
  const per = state.secondsPerTeam;
  const perLabel = per % 60 ? `${Math.floor(per / 60)} min ${per % 60} s` : `${per / 60} min`;
  const rows = state.schedule ?? state.teams;

  return (
    <>
      <div className="bg-surface border border-border rounded-xl p-4 mb-6 flex flex-wrap items-center gap-4">
        <div className="text-3xl font-black text-accent">{state.teams.length}</div>
        <div className="flex-1 min-w-[220px]">
          <div className="font-semibold text-sm">
            {state.drawn ? "Order drawn" : "Teams signed up"} · {perLabel} each, 16:30 to 17:00
          </div>
          <p className="text-muted text-xs">
            Teams sign up at /demo. Draw just before 16:30; drawing closes sign-up and shows the order to everyone.
          </p>
        </div>
        <button onClick={load} className="text-xs px-3 py-2 rounded-lg border border-border hover:border-accent cursor-pointer">
          Refresh
        </button>
        <a href="/api/demo?format=csv" className="text-xs px-3 py-2 rounded-lg border border-border hover:border-accent">
          Download CSV
        </a>
        <a href="/api/demo?format=json" className="text-xs px-3 py-2 rounded-lg border border-border hover:border-accent">
          JSON
        </a>
        {confirm ? (
          <>
            <button onClick={draw} className="text-xs px-3 py-2 rounded-lg bg-indigo-600 text-white cursor-pointer">
              {state.drawn ? "Yes, draw again" : "Yes, draw now"}
            </button>
            <button onClick={() => setConfirm(false)} className="text-xs px-3 py-2 rounded-lg border border-border cursor-pointer">
              Cancel
            </button>
          </>
        ) : (
          <button onClick={() => setConfirm(true)} disabled={state.teams.length === 0}
            className="text-xs px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer disabled:opacity-50">
            {state.drawn ? "Draw again" : "Draw order at random"}
          </button>
        )}
        {state.drawn && (
          <button onClick={clearDraw} className="text-xs px-3 py-2 rounded-lg border border-border hover:border-saaf-red cursor-pointer">
            Clear draw
          </button>
        )}
      </div>
      {error && <p className="text-sm text-saaf-red mb-4">{error}</p>}
      <div className="bg-surface border border-border rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted">
              <th className="px-4 py-3 font-medium">{state.drawn ? "Start" : "#"}</th>
              <th className="px-4 py-3 font-medium">Team and guard</th>
              <th className="px-4 py-3 font-medium">What they built · why they should win</th>
              <th className="px-4 py-3 font-medium">Repo</th>
              <th className="px-4 py-3 font-medium">Signed up by</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t, i) => (
              <tr key={t.id} className="border-b border-border align-top">
                <td className="px-4 py-3 font-mono">{t.start ?? i + 1}</td>
                <td className="px-4 py-3">
                  <div className="font-semibold">{t.team}</div>
                  <div className="text-muted text-xs">{t.title}</div>
                </td>
                <td className="px-4 py-3 text-xs max-w-[420px]">
                  <div>{t.what}</div>
                  <div className="text-muted mt-1">{t.why}</div>
                </td>
                <td className="px-4 py-3 text-xs font-mono">
                  {t.repo ? (
                    <a href={`https://github.com/${t.repo}`} target="_blank" rel="noopener noreferrer" className="hover:text-accent">
                      {t.repo.replace("SAAF-Project/", "")}
                    </a>
                  ) : (
                    <span className="text-muted">none</span>
                  )}
                </td>
                <td className="px-4 py-3 text-muted text-xs">
                  {`${t.name || t.githubUsername} @${t.githubUsername}${t.organisation ? " · " + t.organisation : ""}`}
                </td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => remove(t.id)} className="text-xs px-2 py-1 rounded-lg border border-border hover:border-saaf-red cursor-pointer">
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

interface PizzaAdmin {
  yes: number;
  no: number;
  locked: boolean;
  people?: { choice: string; githubUsername: string; name?: string | null; organisation?: string | null }[];
}

function PizzaTab() {
  const [state, setState] = useState<PizzaAdmin | null>(null);

  const load = () => {
    fetch("/api/pizza")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setState(d))
      .catch(() => setState(null));
  };

  useEffect(() => {
    let active = true;
    fetch("/api/pizza")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (active) setState(d);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  if (state === null) return <div className="text-muted text-center py-12">Loading...</div>;
  const people = state.people ?? [];

  return (
    <>
      <div className="bg-surface border border-border rounded-xl p-4 mb-6 flex flex-wrap items-center gap-4">
        <div className="text-3xl font-black text-accent">{state.yes}</div>
        <div className="flex-1 min-w-[200px]">
          <div className="font-semibold text-sm">Want pizza at 17:30 · {state.no} said no</div>
          <p className="text-muted text-xs">Members choose on the Quiz and Handout pages. Closes at 16:00.</p>
        </div>
        <button onClick={load} className="text-xs px-3 py-2 rounded-lg border border-border hover:border-accent cursor-pointer">
          Refresh
        </button>
      </div>
      <div className="bg-surface border border-border rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted">
              <th className="px-4 py-3 font-medium">Pizza</th>
              <th className="px-4 py-3 font-medium">Member</th>
              <th className="px-4 py-3 font-medium">Organisation</th>
            </tr>
          </thead>
          <tbody>
            {people.map((p) => (
              <tr key={p.githubUsername} className="border-b border-border">
                <td className={`px-4 py-3 font-medium ${p.choice === "yes" ? "text-accent" : "text-muted"}`}>{p.choice}</td>
                <td className="px-4 py-3">{p.name || p.githubUsername} <span className="text-muted text-xs">@{p.githubUsername}</span></td>
                <td className="px-4 py-3 text-muted text-xs">{p.organisation || ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
