import Link from "next/link";
import type { ProfileCompleteness } from "@/lib/profile-completeness";

export default function ProfileCompletenessBanner({ completeness }: { completeness: ProfileCompleteness }) {
  if (completeness.percent >= 100) return null;

  return (
    <div className="mb-6 p-4 bg-saaf-yellow/10 border border-saaf-yellow/30 rounded-xl flex items-center gap-4">
      <div className="text-saaf-yellow text-xl">📋</div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm">
          Your profile is {completeness.percent}% complete
        </div>
        <div className="text-muted text-xs mt-0.5">
          Missing: {completeness.missing.map((m) => m.label).join(", ")}
        </div>
        <div className="h-1 bg-border rounded-full mt-2 overflow-hidden max-w-xs">
          <div
            className="h-full bg-gradient-to-r from-saaf-yellow to-accent transition-all"
            style={{ width: `${completeness.percent}%` }}
          />
        </div>
      </div>
      <Link
        href="/profile"
        className="shrink-0 px-4 py-2 bg-saaf-yellow text-bg text-sm font-semibold rounded-lg hover:opacity-90 no-underline"
      >
        Complete profile →
      </Link>
    </div>
  );
}
