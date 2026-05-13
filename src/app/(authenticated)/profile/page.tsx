"use client";

import { useEffect, useState } from "react";
import UserAvatar from "@/components/UserAvatar";
import SkillSliders from "@/components/SkillSliders";
import AchievementBadge from "@/components/AchievementBadge";
import { ROLES, TRACK_OPTIONS } from "@/lib/constants";
import { suggestOrganisations, type OrgSuggestion } from "@/lib/logo-match";
import type { UserProfile, Achievement } from "@/types";

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Partial<UserProfile>>({});
  const [orgSuggestions, setOrgSuggestions] = useState<OrgSuggestion[]>([]);
  const [achievement, setAchievement] = useState<Achievement | null>(null);

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then((data) => { setProfile(data); setForm(data); });
    fetch("/api/achievements")
      .then((r) => r.json())
      .then(setAchievement)
      .catch(() => {});
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        const updated = await res.json();
        setProfile(updated);
        setForm(updated);
        setEditing(false);
      }
    } finally {
      setSaving(false);
    }
  };

  if (!profile) {
    return <div className="text-muted text-center py-12">Loading profile...</div>;
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-extrabold">Profile</h1>
        <button
          onClick={() => {
            if (editing) {
              setForm(profile);
            }
            setEditing(!editing);
          }}
          className="text-sm text-accent hover:underline cursor-pointer"
        >
          {editing ? "Cancel" : "Edit"}
        </button>
      </div>

      <div className="bg-surface border border-border rounded-2xl p-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6 pb-6 border-b border-border">
          <UserAvatar
            src={profile.avatarUrl}
            alt={profile.name || profile.githubUsername}
            size={64}
          />
          <div className="flex-1">
            <h2 className="text-xl font-bold">
              {profile.name || profile.githubUsername}
            </h2>
            <p className="text-muted text-sm">@{profile.githubUsername}</p>
          </div>
          {profile.companyLogoUrl && (
            <img
              src={profile.companyLogoUrl}
              alt={profile.organisation || "Company logo"}
              className="h-10 w-auto object-contain"
            />
          )}
        </div>

        {/* Fields */}
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Name" editing={editing}>
              {editing ? (
                <input
                  type="text"
                  value={form.name || ""}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm text-text focus:outline-none focus:border-accent"
                />
              ) : (
                <span>{profile.name || "-"}</span>
              )}
            </Field>
            <Field label="Organisation" editing={editing}>
              {editing ? (
                <div className="relative">
                  <input
                    type="text"
                    value={form.organisation || ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      setForm({ ...form, organisation: val });
                      setOrgSuggestions(suggestOrganisations(val));
                    }}
                    onBlur={() => setTimeout(() => setOrgSuggestions([]), 200)}
                    className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm text-text focus:outline-none focus:border-accent"
                    placeholder="Start typing to see suggestions..."
                  />
                  {orgSuggestions.length > 0 && (
                    <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-surface border border-border rounded-lg shadow-lg overflow-hidden">
                      {orgSuggestions.map((s) => (
                        <button
                          key={s.logoUrl}
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            setForm({
                              ...form,
                              organisation: s.name,
                              companyLogoUrl: s.logoUrl,
                              showLogoOnWebsite: true,
                            });
                            setOrgSuggestions([]);
                          }}
                          className="w-full flex items-center gap-3 px-3 py-2 hover:bg-accent/10 cursor-pointer text-left"
                        >
                          <img
                            src={s.logoUrl}
                            alt={s.name}
                            className="h-6 w-6 object-contain"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                          />
                          <span className="text-sm">{s.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <span>{profile.organisation || "-"}</span>
              )}
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Role" editing={editing}>
              {editing ? (
                <select
                  value={form.role || ""}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm text-text focus:outline-none focus:border-accent"
                >
                  <option value="">Select role...</option>
                  {ROLES.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              ) : (
                <span>{profile.role || "-"}</span>
              )}
            </Field>
            <Field label="Preferred Track" editing={editing}>
              {editing ? (
                <select
                  value={form.preferredTrack || ""}
                  onChange={(e) => setForm({ ...form, preferredTrack: e.target.value })}
                  className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm text-text focus:outline-none focus:border-accent"
                >
                  <option value="">Select track...</option>
                  {TRACK_OPTIONS.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              ) : (
                <span>
                  {TRACK_OPTIONS.find((t) => t.value === profile.preferredTrack)?.label || profile.preferredTrack || "-"}
                </span>
              )}
            </Field>
          </div>

          <Field label="Second Track" editing={editing}>
            {editing ? (
              <select
                value={form.secondTrack || ""}
                onChange={(e) => setForm({ ...form, secondTrack: e.target.value })}
                className="w-full max-w-xs px-3 py-2 bg-bg border border-border rounded-lg text-sm text-text focus:outline-none focus:border-accent"
              >
                <option value="">No second choice</option>
                {TRACK_OPTIONS.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            ) : (
              <span>
                {TRACK_OPTIONS.find((t) => t.value === profile.secondTrack)?.label || "-"}
              </span>
            )}
          </Field>

          <div>
            <label className="block text-xs text-muted font-medium mb-2">
              Skills
            </label>
            <SkillSliders
              values={{
                skillPrompts: (editing ? form.skillPrompts : profile.skillPrompts) ?? 3,
                skillTools: (editing ? form.skillTools : profile.skillTools) ?? 3,
                skillRegulatory: (editing ? form.skillRegulatory : profile.skillRegulatory) ?? 3,
                skillOutputs: (editing ? form.skillOutputs : profile.skillOutputs) ?? 3,
              }}
              onChange={(key, value) => setForm({ ...form, [key]: value })}
              disabled={!editing}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Company Logo URL" editing={editing}>
              {editing ? (
                <>
                  <input
                    type="url"
                    value={form.companyLogoUrl || ""}
                    onChange={(e) => setForm({ ...form, companyLogoUrl: e.target.value })}
                    placeholder="https://example.com/logo.png"
                    className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm text-text focus:outline-none focus:border-accent"
                  />
                  <p className="text-[11px] text-muted mt-1">
                    HTTPS only, must end in .png, .jpg, .jpeg, .svg, or .webp
                  </p>
                </>
              ) : (
                <span className="text-sm truncate block">
                  {profile.companyLogoUrl || "-"}
                </span>
              )}
            </Field>
            <Field label="Show logo on website" editing={editing}>
              {editing ? (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.showLogoOnWebsite || false}
                    onChange={(e) =>
                      setForm({ ...form, showLogoOnWebsite: e.target.checked })
                    }
                    className="w-4 h-4"
                  />
                  <span className="text-sm">Show on public website</span>
                </label>
              ) : (
                <span>{profile.showLogoOnWebsite ? "Yes" : "No"}</span>
              )}
            </Field>
          </div>
        </div>

        {editing && (
          <div className="flex justify-end gap-3 mt-6 pt-6 border-t border-border">
            <button
              onClick={() => {
                setForm(profile);
                setEditing(false);
              }}
              className="px-4 py-2 text-sm text-muted border border-border rounded-lg hover:text-text cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2 text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg disabled:opacity-50 cursor-pointer"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        )}
      </div>

      {/* Achievements — separate section */}
      <div className="mt-6">
        <h2 className="text-lg font-extrabold mb-3">Achievements</h2>
        {achievement !== null ? (
          <AchievementBadge
            level={achievement.observabilityLevel}
            count={achievement.observabilityCount}
            nextLevelAt={achievement.nextLevelAt}
          />
        ) : (
          <div className="bg-surface border border-border rounded-xl p-4 text-muted text-sm">
            Loading achievements...
          </div>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  editing,
  children,
}: {
  label: string;
  editing: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs text-muted font-medium mb-1">
        {label}
      </label>
      <div className={editing ? "" : "text-sm font-medium"}>{children}</div>
    </div>
  );
}
