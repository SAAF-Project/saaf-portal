import type { Plan } from "@/types";

const TYPE_COLORS: Record<string, string> = {
  agent: "bg-accent/20 text-accent",
  skill: "bg-saaf-green/15 text-saaf-green",
  workflow: "bg-saaf-orange/20 text-saaf-orange",
  framework: "bg-muted/15 text-muted",
  reference: "bg-muted/15 text-muted",
};

const PDCA_PHASES = ["plan", "do", "check", "act"] as const;

export default function PlanCard({ plan }: { plan: Plan }) {
  const typeKey = (plan.type || "").toLowerCase();
  const typeClass = TYPE_COLORS[typeKey] || "bg-muted/15 text-muted";
  const stars = plan.quality_score
    ? "★".repeat(plan.quality_score) + "☆".repeat(5 - plan.quality_score)
    : "";

  return (
    <div className="inline-block bg-accent/7 border border-accent/15 rounded-lg p-2 px-3 m-1 align-top max-w-[260px] transition-all hover:border-accent/35 hover:bg-accent/12">
      <a
        href={plan.github_url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs font-semibold text-accent no-underline hover:underline block mb-1 leading-snug"
      >
        {plan.title || plan.slug}
      </a>
      <div className="flex items-center gap-1.5 flex-wrap">
        {plan.type && (
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wide ${typeClass}`}
          >
            {plan.type}
          </span>
        )}
        {stars && (
          <span
            className="text-[10px] text-saaf-yellow tracking-tight"
            title={`Quality: ${plan.quality_score}/5`}
          >
            {stars}
          </span>
        )}
        <span className="inline-flex gap-0.5 items-center">
          {PDCA_PHASES.map((phase) => {
            const st = plan.pdca?.[phase] || "not_started";
            const cls =
              st === "complete"
                ? "bg-saaf-green"
                : st === "in_progress"
                  ? "bg-saaf-yellow"
                  : "bg-border";
            return (
              <span
                key={phase}
                className={`inline-block w-[7px] h-[7px] rounded-full ${cls}`}
                title={`${phase}: ${st.replace("_", " ")}`}
              />
            );
          })}
        </span>
        {plan.claimed_by && (
          <span className="text-[11px]" title={`Claimed by ${plan.claimed_by}`}>
            👤
          </span>
        )}
      </div>
    </div>
  );
}
