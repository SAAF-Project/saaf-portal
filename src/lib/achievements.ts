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

const COLOR_CLASSES = {
  bronze: "text-saaf-orange border-saaf-orange/40 bg-saaf-orange/10",
  silver: "text-muted border-muted/40 bg-muted/10",
  gold: "text-saaf-yellow border-saaf-yellow/40 bg-saaf-yellow/10",
  platinum: "text-accent border-accent/40 bg-accent/10",
  diamond: "text-saaf-purple border-saaf-purple/40 bg-saaf-purple/10",
  empty: "text-border border-border bg-surface2",
};

const STANDARD_LEVELS = (thresholds: number[]): BadgeLevel[] => [
  { level: 1, label: "Bronze", icon: "🥉", threshold: thresholds[0], colorClass: COLOR_CLASSES.bronze },
  { level: 2, label: "Silver", icon: "🥈", threshold: thresholds[1], colorClass: COLOR_CLASSES.silver },
  { level: 3, label: "Gold", icon: "🥇", threshold: thresholds[2], colorClass: COLOR_CLASSES.gold },
  { level: 4, label: "Platinum", icon: "💎", threshold: thresholds[3], colorClass: COLOR_CLASSES.platinum },
  { level: 5, label: "Diamond", icon: "🏆", threshold: thresholds[4], colorClass: COLOR_CLASSES.diamond },
];

const SHORT_LEVELS_3 = (thresholds: number[]): BadgeLevel[] => [
  { level: 1, label: "Bronze", icon: "🥉", threshold: thresholds[0], colorClass: COLOR_CLASSES.bronze },
  { level: 2, label: "Silver", icon: "🥈", threshold: thresholds[1], colorClass: COLOR_CLASSES.silver },
  { level: 3, label: "Gold", icon: "🥇", threshold: thresholds[2], colorClass: COLOR_CLASSES.gold },
];

const SHORT_LEVELS_2 = (thresholds: number[]): BadgeLevel[] => [
  { level: 1, label: "Bronze", icon: "🥉", threshold: thresholds[0], colorClass: COLOR_CLASSES.bronze },
  { level: 2, label: "Gold", icon: "🥇", threshold: thresholds[1], colorClass: COLOR_CLASSES.gold },
];

const BADGE_DEFINITIONS = {
  observability: {
    title: "Observability Observer",
    description: "Submit observability checks per AI audit plan.",
    howToEarn: "Submit observability checks per AI audit plan on the Tracks page. Each unique plan-check counts.",
    levels: STANDARD_LEVELS([1, 6, 11, 21, 36]),
  },
  mergedPRs: {
    title: "Contributor",
    description: "Merge pull requests into the SAAF repository.",
    howToEarn: "Open a PR to SAAF-Project/SAAF-Project and get it merged. Each merged PR earns a badge level.",
    levels: STANDARD_LEVELS([1, 2, 3, 4, 5]),
  },
  newPlans: {
    title: "Plan Author",
    description: "Author new audit plan files.",
    howToEarn: "Add a new plan file to plans/hackathon-X/ in your PR. Capped at 3 new plans.",
    levels: SHORT_LEVELS_3([1, 2, 3]),
  },
  planUpdates: {
    title: "Plan Improver",
    description: "Improve existing audit plan files.",
    howToEarn: "Edit existing plan files in your PRs — update PDCA status, add sections, improve prompts.",
    levels: STANDARD_LEVELS([1, 5, 10, 25, 50]),
  },
  claims: {
    title: "Implementer",
    description: "Claim plans you are implementing at your organisation.",
    howToEarn: "Set 'Claimed By' to your name in any plan's metadata. Capped at 2 claims.",
    levels: SHORT_LEVELS_2([1, 2]),
  },
} as const;

export function computeBadge(key: keyof typeof BADGE_DEFINITIONS, count: number): Badge {
  const def = BADGE_DEFINITIONS[key];
  const levels = def.levels;
  let level = 0;
  let currentLevelData: BadgeLevel | null = null;
  let nextLevelData: BadgeLevel | null = levels[0];

  for (const lvl of levels) {
    if (count >= lvl.threshold) {
      level = lvl.level;
      currentLevelData = lvl;
      nextLevelData = levels[lvl.level] || null;
    }
  }

  return {
    key,
    title: def.title,
    description: def.description,
    howToEarn: def.howToEarn,
    count,
    level,
    currentLevelData,
    nextLevelData,
    levels,
  };
}

export const BADGE_KEYS: (keyof typeof BADGE_DEFINITIONS)[] = [
  "observability",
  "mergedPRs",
  "newPlans",
  "planUpdates",
  "claims",
];
