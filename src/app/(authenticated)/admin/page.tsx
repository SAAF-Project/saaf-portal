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
  const [tab, setTab] = useState<"signups" | "feedback">("signups");
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
      </div>

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
                  <tr key={req.id} className="border-b border-white/4">
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
                  <tr key={req.id} className="border-b border-white/4 opacity-70">
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
