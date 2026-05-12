import type { ActivityEntry } from "@/types";

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function ActivityFeed({
  entries,
}: {
  entries: ActivityEntry[];
}) {
  if (entries.length === 0) {
    return (
      <p className="text-muted text-center py-6 text-sm">No activity yet.</p>
    );
  }

  return (
    <div className="space-y-2">
      {entries.map((entry) => (
        <div
          key={entry.num}
          className="p-3 rounded-lg border-l-3 border-saaf-green bg-white/2 hover:bg-white/4 transition-colors"
        >
          <a
            href={entry.url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-sm text-text no-underline hover:underline block mb-1 leading-snug"
          >
            {entry.title}
          </a>
          <div className="text-[11px] text-muted">
            by @{entry.author} · {timeAgo(entry.merged_at)} · PR #{entry.num}
          </div>
          {entry.planFiles.length > 0 && (
            <div className="text-[11px] text-accent mt-1">
              {entry.planFiles
                .map(
                  (f) =>
                    `${f.status === "added" ? "+" : "~"} ${f.filename.split("/").pop()}`
                )
                .join(" · ")}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
