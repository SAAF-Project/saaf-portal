import type { Plan, UserProfile } from "@/types";

export interface SuggestedPlan extends Plan {
  reasons: string[];
  score: number;
}

export function suggestPlans(
  plans: Plan[],
  user: UserProfile,
  alreadyMine: Set<string>,
  limit = 5
): SuggestedPlan[] {
  const userTrack = user.preferredTrack || "";
  const userTrackBase = userTrack.replace(/[ab]$/, "");

  const skills = {
    Agent: user.skillTools,
    Skill: user.skillRegulatory,
    Workflow: user.skillTools,
    Framework: user.skillPrompts,
    Reference: user.skillRegulatory,
  } as Record<string, number>;

  const scored = plans
    .filter((p) => !alreadyMine.has(p.slug))
    .map((p) => {
      const reasons: string[] = [];
      let score = 0;

      const planTrack = p.track !== null ? String(p.track) : "";
      if (userTrack && (planTrack === userTrack || planTrack === userTrackBase)) {
        score += 3;
        reasons.push(`Matches your track ${userTrack}`);
      }

      if (!p.claimed_by) {
        score += 2;
        reasons.push("Unclaimed — open for you to take");
      }

      if (p.pdca?.do === "in_progress") {
        score += 2;
        reasons.push("Active development");
      }

      if (p.type && skills[p.type] && skills[p.type] >= 4) {
        score += 1;
        reasons.push(`Matches your ${p.type.toLowerCase()} skills`);
      }

      if (p.quality_score >= 4) {
        score += 1;
        reasons.push("High-quality plan");
      }

      return { ...p, score, reasons };
    })
    .filter((p) => p.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return scored;
}
