import type { Track, Plan } from "@/types";
import { TRACK_TASKS, TABLE_MAPPING } from "@/lib/constants";
import PlanCard from "./PlanCard";

export default function TrackCard({
  track,
  plans,
}: {
  track: Track;
  plans: Plan[];
}) {
  const tasks = TRACK_TASKS[track.id] || [];
  const tables = TABLE_MAPPING[track.id] || [];

  return (
    <div className="bg-surface border border-border rounded-2xl p-6 mb-4 transition-all hover:border-accent/40 hover:shadow-lg hover:shadow-accent/5">
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="text-lg font-bold">
            Track {track.id}: {track.short_name}
          </h3>
          <p className="text-muted text-sm">{track.mission}</p>
        </div>
        <span className="text-4xl font-extrabold bg-gradient-to-br from-accent to-saaf-purple bg-clip-text text-transparent opacity-50">
          {track.id}
        </span>
      </div>

      <div className="flex gap-2 flex-wrap mb-3">
        {Object.entries(track.team).map(([role, count]) => (
          <span
            key={role}
            className="text-xs px-2.5 py-1 rounded-full bg-accent/10 text-muted font-medium"
          >
            {count}× {role}
          </span>
        ))}
      </div>

      {tables.length > 0 && (
        <div className="text-xs text-muted mb-3">
          {tables.map((t) => `Table ${t.table}: ${t.focus}`).join(" · ")}
        </div>
      )}

      {tasks.length > 0 && (
        <div className="mb-4">
          <h4 className="text-xs text-muted uppercase tracking-wider font-semibold mb-2">
            Tasks (4-5 hours)
          </h4>
          {tasks.map((task, i) => (
            <div
              key={i}
              className="flex gap-2.5 py-1.5 text-[13px] border-b border-white/4 last:border-b-0"
            >
              <span className="text-saaf-yellow min-w-[50px] font-semibold">
                {task.time}
              </span>
              <span>{task.task}</span>
            </div>
          ))}
        </div>
      )}

      <div>
        <h4 className="text-xs text-muted uppercase tracking-wider font-semibold mb-2">
          {plans.length} Plans
        </h4>
        <div className="flex flex-wrap">
          {plans.map((plan) => (
            <PlanCard key={plan.slug} plan={plan} />
          ))}
        </div>
      </div>
    </div>
  );
}
