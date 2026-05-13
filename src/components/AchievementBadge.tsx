const LEVELS = [
  { label: "None", icon: "", color: "" },
  { label: "Bronze", icon: "🥉", color: "text-saaf-orange border-saaf-orange/30 bg-saaf-orange/10" },
  { label: "Silver", icon: "🥈", color: "text-muted border-muted/30 bg-muted/10" },
  { label: "Gold", icon: "🥇", color: "text-saaf-yellow border-saaf-yellow/30 bg-saaf-yellow/10" },
  { label: "Platinum", icon: "💎", color: "text-accent border-accent/30 bg-accent/10" },
  { label: "Diamond", icon: "🏆", color: "text-saaf-purple border-saaf-purple/30 bg-saaf-purple/10" },
];

const THRESHOLDS = [0, 1, 6, 11, 21, 36];

export default function AchievementBadge({
  level,
  count,
  nextLevelAt,
  compact = false,
}: {
  level: number;
  count: number;
  nextLevelAt: number | null;
  compact?: boolean;
}) {
  if (level === 0 && compact) return null;

  const l = LEVELS[level] || LEVELS[0];
  const nextL = level < 5 ? LEVELS[level + 1] : null;

  if (compact) {
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-semibold ${l.color}`}>
        {l.icon} Observability {l.label}
      </span>
    );
  }

  return (
    <div className="bg-surface border border-border rounded-xl p-4">
      <h3 className="text-xs font-bold text-muted uppercase tracking-wider mb-3">
        Observability Badge
      </h3>
      <div className="flex items-center gap-4">
        <div className={`text-4xl p-3 rounded-xl border ${level > 0 ? l.color : "text-border border-border bg-surface2"}`}>
          {level > 0 ? l.icon : "○"}
        </div>
        <div>
          <div className="font-bold text-base">
            {level > 0 ? `Level ${level} — ${l.label}` : "Not earned yet"}
          </div>
          <div className="text-muted text-xs mt-0.5">
            {count} observability check{count !== 1 ? "s" : ""} submitted
          </div>
          {nextL && nextLevelAt && (
            <div className="text-xs text-accent mt-1">
              {nextLevelAt - count} more to reach {nextL.icon} {nextL.label}
            </div>
          )}
          {level === 5 && (
            <div className="text-xs text-saaf-purple mt-1">Maximum level reached!</div>
          )}
        </div>
      </div>

      {/* Progress bar to next level */}
      {level < 5 && nextLevelAt && (
        <div className="mt-3">
          <div className="flex justify-between text-[10px] text-muted mb-1">
            <span>{THRESHOLDS[level]} checks</span>
            <span>{nextLevelAt} checks</span>
          </div>
          <div className="h-1.5 bg-border rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full bg-gradient-to-r from-accent to-saaf-purple transition-all`}
              style={{ width: `${Math.min(100, ((count - THRESHOLDS[level]) / (nextLevelAt - THRESHOLDS[level])) * 100)}%` }}
            />
          </div>
        </div>
      )}

      <div className="mt-3 text-[11px] text-muted leading-relaxed">
        <span className="font-medium text-text">How to earn:</span> Submit observability checks per AI audit plan on the Tracks page. Each unique plan-check counts.
        <div className="flex gap-2 mt-2 flex-wrap">
          {LEVELS.slice(1).map((lvl, i) => (
            <span key={i} className={`text-[10px] px-1.5 py-0.5 rounded border ${level > i ? lvl.color : "text-border border-border"}`}>
              {lvl.icon} {THRESHOLDS[i + 1]}+
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
