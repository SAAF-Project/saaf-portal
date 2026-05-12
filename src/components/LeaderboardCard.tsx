import type { ScoreEntry } from "@/types";

const MAX_SCORE = 105;

function rankIcon(rank: number): string {
  if (rank === 0) return "🥇";
  if (rank === 1) return "🥈";
  if (rank === 2) return "🥉";
  return `#${rank + 1}`;
}

export default function LeaderboardCard({
  entry,
  rank,
  onClick,
}: {
  entry: ScoreEntry;
  rank: number;
  onClick?: () => void;
}) {
  const pct = Math.min(100, (entry.total / MAX_SCORE) * 100);
  const rankStyles =
    rank === 0
      ? "bg-gradient-to-r from-saaf-yellow/8 to-saaf-yellow/3 border-saaf-yellow/30 shadow-saaf-yellow/8"
      : rank === 1
        ? "bg-gradient-to-r from-muted/8 to-muted/3 border-muted/25"
        : rank === 2
          ? "bg-gradient-to-r from-saaf-orange/8 to-saaf-orange/3 border-saaf-orange/25"
          : "";

  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-4 bg-surface border border-border rounded-xl p-4 mb-2.5 transition-all hover:border-accent/30 hover:-translate-y-0.5 cursor-pointer ${rankStyles}`}
    >
      <span
        className={`text-2xl min-w-[40px] text-center font-black ${
          rank === 0
            ? "text-saaf-yellow"
            : rank === 1
              ? "text-gray-400"
              : rank === 2
                ? "text-saaf-orange"
                : "text-muted/30 text-lg"
        }`}
      >
        {rankIcon(rank)}
      </span>

      <img
        src={`https://github.com/${entry.login}.png?size=96`}
        alt={entry.login}
        className={`w-12 h-12 rounded-full border-2 ${
          rank === 0
            ? "border-saaf-yellow/40"
            : rank === 1
              ? "border-muted/30"
              : rank === 2
                ? "border-saaf-orange/30"
                : "border-border"
        }`}
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = "none";
        }}
      />

      <div className="flex-1 min-w-0">
        <div className="font-bold text-base">@{entry.login}</div>
        <div className="flex gap-2 flex-wrap mt-1">
          {entry.prs > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-saaf-green/12 text-saaf-green font-semibold">
              {entry.prs} PR{entry.prs !== 1 ? "s" : ""}
            </span>
          )}
          {entry.newPlans > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/15 text-accent font-semibold">
              {entry.newPlans} plan{entry.newPlans !== 1 ? "s" : ""}
            </span>
          )}
          {entry.updateCount > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-saaf-purple/12 text-saaf-purple font-semibold">
              {entry.updateCount} update{entry.updateCount !== 1 ? "s" : ""}
            </span>
          )}
          {entry.claims > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-saaf-yellow/12 text-saaf-yellow font-semibold">
              {entry.claims} claim{entry.claims !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>

      <div className="text-right min-w-[80px]">
        <div
          className={`text-2xl font-black ${rank === 0 ? "text-saaf-yellow" : ""}`}
        >
          {entry.total}
          <span className="text-sm font-medium text-muted"> / {MAX_SCORE}</span>
        </div>
        <div className="h-1 bg-border rounded-full mt-1 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-600 ${
              rank === 0
                ? "bg-gradient-to-r from-saaf-yellow to-saaf-orange"
                : "bg-gradient-to-r from-accent to-saaf-purple"
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  );
}
