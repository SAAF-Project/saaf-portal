"use client";

import { useEffect, useState } from "react";
import type { OrgRepo } from "@/lib/github";

export default function MyReposPage() {
  const [repos, setRepos] = useState<OrgRepo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/repos")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setRepos(data);
        else if (data.error) setError(data.error);
      })
      .catch(() => setError("Failed to load repos"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-extrabold mb-6">My Repos</h1>
      <p className="text-muted text-sm mb-6">
        Repositories you have contributed to in the SAAF-Project organization.
      </p>

      {loading ? (
        <div className="text-muted text-center py-12">Loading repos...</div>
      ) : error ? (
        <div className="bg-saaf-red/10 border border-saaf-red/30 rounded-xl p-4 text-sm text-saaf-red">
          {error}
        </div>
      ) : repos.length === 0 ? (
        <div className="bg-surface border border-border rounded-2xl p-8 text-center">
          <h3 className="font-bold mb-2">No repos found</h3>
          <p className="text-muted text-sm mb-4">
            You haven&apos;t contributed to any repos in the SAAF-Project org
            yet. Fork the main repo to get started.
          </p>
          <a
            href="https://github.com/SAAF-Project/SAAF-Project"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl no-underline"
          >
            Go to SAAF Repository ↗
          </a>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-3">
          {repos.map((repo) => (
            <a
              key={repo.name}
              href={repo.html_url}
              target="_blank"
              rel="noopener noreferrer"
              className="block bg-surface border border-border rounded-xl p-4 hover:border-accent/30 transition-all no-underline group"
            >
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-bold text-sm group-hover:text-accent transition-colors">
                  {repo.name}
                </h3>
                {repo.fork && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/12 text-accent font-semibold">
                    fork
                  </span>
                )}
              </div>
              {repo.description && (
                <p className="text-muted text-xs mb-3 line-clamp-2">
                  {repo.description}
                </p>
              )}
              <div className="flex items-center gap-3 text-[11px] text-muted">
                {repo.language && (
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-accent" />
                    {repo.language}
                  </span>
                )}
                {repo.stargazers_count > 0 && (
                  <span>★ {repo.stargazers_count}</span>
                )}
                <span>
                  Updated{" "}
                  {new Date(repo.updated_at).toLocaleDateString()}
                </span>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
