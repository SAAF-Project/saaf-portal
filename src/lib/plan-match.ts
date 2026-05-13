import type { Plan, Submitter, UserProfile } from "@/types";

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function getUserPlans(
  plans: Plan[],
  user: UserProfile,
  submitters: Submitter[]
): Plan[] {
  const userName = normalize(user.name || "");
  const ghUser = normalize(user.githubUsername || "");

  const matchedSubmitter = submitters.find((s) => {
    const sn = normalize(s.name);
    return (
      sn === userName ||
      sn === ghUser ||
      (userName.length > 3 && sn.includes(userName)) ||
      (userName.length > 3 && userName.includes(sn)) ||
      (ghUser.length > 3 && sn.includes(ghUser))
    );
  });

  const slugsFromSubmitter = new Set(matchedSubmitter?.plans || []);

  const nameFragments = (user.name || "")
    .split(/\s+/)
    .filter((p) => p.length > 2)
    .map((p) => p.toLowerCase());

  return plans.filter((plan) => {
    if (slugsFromSubmitter.has(plan.slug)) return true;
    if (
      plan.claimed_by &&
      nameFragments.some((f) => plan.claimed_by.toLowerCase().includes(f))
    )
      return true;
    return false;
  });
}
