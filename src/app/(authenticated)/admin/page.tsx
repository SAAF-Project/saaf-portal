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

export default function AdminPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [requests, setRequests] = useState<SignupRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const username = (session?.user as { githubUsername?: string })
    ?.githubUsername;

  useEffect(() => {
    if (session && username !== "MSACC") {
      router.push("/dashboard");
      return;
    }

    fetch("/api/admin/signups")
      .then((r) => {
        if (r.status === 403) throw new Error("Forbidden");
        return r.json();
      })
      .then(setRequests)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [session, username, router]);

  const pending = requests.filter((r) => r.status === "pending");
  const processed = requests.filter((r) => r.status !== "pending");

  if (loading) {
    return <div className="text-muted text-center py-12">Loading...</div>;
  }

  if (error) {
    return (
      <div className="text-saaf-red text-center py-12">Access denied</div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-extrabold mb-6">Admin — Signup Requests</h1>

      {/* Pending count */}
      <div className="bg-surface border border-border rounded-xl p-4 mb-6 flex items-center gap-4">
        <div className="text-3xl font-black text-saaf-yellow">
          {pending.length}
        </div>
        <div>
          <div className="font-semibold text-sm">Pending requests</div>
          <p className="text-muted text-xs">
            Process via: <code className="bg-surface2 px-1.5 py-0.5 rounded text-[11px]">npx tsx scripts/process-signups.ts</code>
          </p>
        </div>
      </div>

      {/* Pending */}
      {pending.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xs font-bold text-muted uppercase tracking-wider mb-3">
            Pending
          </h2>
          <div className="bg-surface border border-border rounded-xl overflow-hidden">
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
                    <td className="px-4 py-3 font-semibold">
                      @{req.githubUsername}
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {req.email || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={req.status} />
                    </td>
                    <td className="px-4 py-3 text-muted text-xs">
                      {new Date(req.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Processed */}
      {processed.length > 0 && (
        <div>
          <h2 className="text-xs font-bold text-muted uppercase tracking-wider mb-3">
            Processed ({processed.length})
          </h2>
          <div className="bg-surface border border-border rounded-xl overflow-hidden">
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
                  <tr
                    key={req.id}
                    className="border-b border-white/4 opacity-70"
                  >
                    <td className="px-4 py-3 font-semibold">
                      @{req.githubUsername}
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {req.email || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={req.status} />
                    </td>
                    <td className="px-4 py-3 text-muted text-xs">
                      {new Date(req.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-muted text-xs">
                      {req.processedAt
                        ? new Date(req.processedAt).toLocaleString()
                        : "—"}
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
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles =
    status === "pending"
      ? "bg-saaf-yellow/15 text-saaf-yellow"
      : status === "approved"
        ? "bg-saaf-green/15 text-saaf-green"
        : "bg-saaf-red/15 text-saaf-red";

  return (
    <span
      className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${styles}`}
    >
      {status}
    </span>
  );
}
