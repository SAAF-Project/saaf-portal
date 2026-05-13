"use client";

import { useEffect, useState } from "react";
import type { Participant } from "@/types";
import { TRACK_OPTIONS } from "@/lib/constants";

const ROLE_COLORS: Record<string, string> = {
  Auditor: "bg-accent/15 text-accent",
  Vaktechniek: "bg-saaf-purple/15 text-saaf-purple",
  Analyst: "bg-saaf-green/15 text-saaf-green",
  Engineer: "bg-saaf-orange/15 text-saaf-orange",
};

function SkillBar({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[9px] text-muted w-14 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden">
        <div
          className="h-full bg-accent rounded-full"
          style={{ width: `${(value / 5) * 100}%` }}
        />
      </div>
      <span className="text-[9px] text-muted w-3 text-right">{value}</span>
    </div>
  );
}

export default function ParticipantsPage() {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterRole, setFilterRole] = useState("");
  const [filterTrack, setFilterTrack] = useState("");
  const [filterOrg, setFilterOrg] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/participants")
      .then((r) => r.json())
      .then(setParticipants)
      .finally(() => setLoading(false));
  }, []);

  const orgs = [...new Set(participants.map((p) => p.organisation).filter(Boolean))].sort() as string[];
  const roles = ["Auditor", "Vaktechniek", "Analyst", "Engineer"];

  const filtered = participants.filter((p) => {
    if (filterRole && p.role !== filterRole) return false;
    if (filterTrack && p.preferredTrack !== filterTrack) return false;
    if (filterOrg && p.organisation !== filterOrg) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        (p.name || "").toLowerCase().includes(q) ||
        p.githubUsername.toLowerCase().includes(q) ||
        (p.organisation || "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-extrabold">Participants</h1>
        <span className="text-muted text-sm">{filtered.length} / {participants.length}</span>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap mb-5">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, username, org..."
          className="px-3 py-1.5 bg-surface border border-border rounded-lg text-sm text-text focus:outline-none focus:border-accent flex-1 min-w-40"
        />
        <select
          value={filterRole}
          onChange={(e) => setFilterRole(e.target.value)}
          className="px-3 py-1.5 bg-surface border border-border rounded-lg text-sm text-text focus:outline-none focus:border-accent"
        >
          <option value="">All roles</option>
          {roles.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <select
          value={filterTrack}
          onChange={(e) => setFilterTrack(e.target.value)}
          className="px-3 py-1.5 bg-surface border border-border rounded-lg text-sm text-text focus:outline-none focus:border-accent"
        >
          <option value="">All tracks</option>
          {TRACK_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <select
          value={filterOrg}
          onChange={(e) => setFilterOrg(e.target.value)}
          className="px-3 py-1.5 bg-surface border border-border rounded-lg text-sm text-text focus:outline-none focus:border-accent"
        >
          <option value="">All organisations</option>
          {orgs.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
        {(filterRole || filterTrack || filterOrg || search) && (
          <button
            onClick={() => { setFilterRole(""); setFilterTrack(""); setFilterOrg(""); setSearch(""); }}
            className="px-3 py-1.5 text-sm text-muted hover:text-text border border-border rounded-lg cursor-pointer"
          >
            Clear
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-muted text-center py-12">Loading participants...</div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((p) => (
            <div key={p.id} className="bg-surface border border-border rounded-xl p-4 hover:border-accent/30 transition-all">
              <div className="flex items-center gap-3 mb-3">
                <img
                  src={p.avatarUrl || `https://github.com/${p.githubUsername}.png?size=96`}
                  alt={p.name || p.githubUsername}
                  className="w-10 h-10 rounded-full border border-border shrink-0"
                  onError={(e) => { (e.target as HTMLImageElement).src = `https://github.com/${p.githubUsername}.png?size=96`; }}
                />
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-sm truncate">{p.name || p.githubUsername}</div>
                  <div className="text-muted text-xs">@{p.githubUsername}</div>
                </div>
                {p.companyLogoUrl && (
                  <img
                    src={p.companyLogoUrl}
                    alt=""
                    className="h-6 w-auto object-contain shrink-0"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                )}
              </div>

              <div className="flex items-center gap-2 mb-3 flex-wrap">
                {p.organisation && (
                  <span className="text-xs text-muted">{p.organisation}</span>
                )}
                {p.role && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${ROLE_COLORS[p.role] || "bg-muted/10 text-muted"}`}>
                    {p.role}
                  </span>
                )}
                {p.preferredTrack && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-border/50 text-muted font-medium">
                    Track {p.preferredTrack}
                  </span>
                )}
              </div>

              <div className="space-y-1">
                <SkillBar value={p.skillPrompts} label="Prompts" />
                <SkillBar value={p.skillTools} label="Tools" />
                <SkillBar value={p.skillRegulatory} label="Regulatory" />
                <SkillBar value={p.skillOutputs} label="Outputs" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
