export interface Plan {
  slug: string;
  title: string;
  session: string;
  submitter: string;
  organisation: string;
  type: string;
  domain: string;
  status: string;
  claimed_by: string;
  pdca: {
    plan: string;
    do: string;
    check: string;
    act: string;
  };
  quality_score: number;
  track: number | null;
  track_name: string | null;
  role_in_track: string;
  problem_summary: string;
  github_url: string;
}

export interface Track {
  id: number;
  name: string;
  short_name: string;
  mission: string;
  team: Record<string, number>;
}

export interface Submitter {
  name: string;
  plans: string[];
}

export interface ScoreEntry {
  login: string;
  prs: number;
  newPlans: number;
  updateCount: number;
  claims: number;
  total: number;
  prList: { num: number; title: string; merged_at: string; url: string }[];
  firstMergedAt: string | null;
  lastMergedAt: string | null;
}

export interface ActivityEntry {
  num: number;
  author: string;
  title: string;
  merged_at: string;
  url: string;
  planFiles: { filename: string; status: string }[];
}

export interface UserProfile {
  id: string;
  githubUsername: string;
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
  organisation: string | null;
  role: string | null;
  preferredTrack: string | null;
  secondTrack: string | null;
  skillPrompts: number;
  skillTools: number;
  skillRegulatory: number;
  skillOutputs: number;
  companyLogoUrl: string | null;
  showLogoOnWebsite: boolean;
}

export interface TrackTasks {
  [trackId: number]: { time: string; task: string }[];
}

export interface Participant {
  id: string;
  githubUsername: string;
  name: string | null;
  avatarUrl: string | null;
  organisation: string | null;
  companyLogoUrl: string | null;
  role: string | null;
  preferredTrack: string | null;
  skillPrompts: number;
  skillTools: number;
  skillRegulatory: number;
  skillOutputs: number;
  githubId: number;
}

export interface BadgeLevel {
  level: number;
  label: string;
  icon: string;
  threshold: number;
  colorClass: string;
}

export interface Badge {
  key: string;
  title: string;
  description: string;
  howToEarn: string;
  count: number;
  level: number;
  currentLevelData: BadgeLevel | null;
  nextLevelData: BadgeLevel | null;
  levels: BadgeLevel[];
}

export interface Achievement {
  badges: Badge[];
}

export interface ActivityStats {
  mergedPRs: number;
  newPlans: number;
  observabilityChecks: number;
  newParticipants: number;
  contributorCount: number;
}

export interface SuggestedPlanWithReasons extends Plan {
  score: number;
  reasons: string[];
}
