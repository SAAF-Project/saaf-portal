import type { Badge } from "@/types";

export default function AchievementBadge({
  badge,
  compact = false,
}: {
  badge: Badge;
  compact?: boolean;
}) {
  const { count, level, currentLevelData, nextLevelData, levels } = badge;
  const earned = level > 0;

  if (compact) {
    if (!earned) return null;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-semibold ${currentLevelData!.colorClass}`}>
        {currentLevelData!.icon} {badge.title} {currentLevelData!.label}
      </span>
    );
  }

  // Progress: count / nextLevelAt — what fraction of the next-level threshold you've achieved
  let pct = 0;
  if (nextLevelData) {
    pct = Math.max(2, Math.min(100, (count / nextLevelData.threshold) * 100));
  } else {
    pct = 100;
  }

  return (
    <div className="bg-surface border border-border rounded-xl p-4">
      <h3 className="text-xs font-bold text-muted uppercase tracking-wider mb-3">
        {badge.title}
      </h3>
      <div className="flex items-center gap-4">
        <div className={`text-4xl p-3 rounded-xl border ${earned ? currentLevelData!.colorClass : "text-border border-border bg-surface2"}`}>
          {earned ? currentLevelData!.icon : "○"}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-base">
            {earned ? `Level ${level} — ${currentLevelData!.label}` : "Not earned yet"}
          </div>
          <div className="text-muted text-xs mt-0.5">
            {count} {badge.description.toLowerCase().includes("plan") || badge.description.toLowerCase().includes("claim") || badge.description.toLowerCase().includes("pull") ? "" : ""}
            {count === 1 ? "contribution" : "contributions"}
          </div>
          {nextLevelData && (
            <div className="text-xs text-accent mt-1">
              {nextLevelData.threshold - count} more to reach {nextLevelData.icon} {nextLevelData.label}
            </div>
          )}
          {!nextLevelData && earned && (
            <div className="text-xs text-saaf-purple mt-1">Maximum level reached!</div>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {nextLevelData && (
        <div className="mt-3">
          <div className="flex justify-between text-[10px] text-muted mb-1">
            <span>{count} / {nextLevelData.threshold}</span>
            <span>Next: {nextLevelData.icon} {nextLevelData.label}</span>
          </div>
          <div className="h-2 bg-border rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-accent to-saaf-purple transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      <div className="mt-3 text-[11px] text-muted leading-relaxed">
        <span className="font-medium text-text">How to earn:</span> {badge.howToEarn}
        <div className="flex gap-2 mt-2 flex-wrap">
          {levels.map((lvl) => (
            <span
              key={lvl.level}
              className={`text-[10px] px-1.5 py-0.5 rounded border ${level >= lvl.level ? lvl.colorClass : "text-border border-border"}`}
            >
              {lvl.icon} {lvl.threshold}+
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
