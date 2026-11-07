// Navigation of the portal, grouped so the bar stays readable on every screen width (#15).
// "Learn" holds the portal guides (how to use the portal), "Build" the technical docs (how to contribute and adopt the
// standards). Pages and routes are unchanged; only the way they are reached is.

export interface NavItem {
  href: string;
  label: string;
  icon: string;
}

export interface NavGroup {
  id: string;
  label: string;
  hint: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    id: "work",
    label: "Your work",
    hint: "What you are working on",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: "◆" },
      { href: "/my-repos", label: "My Repos", icon: "◇" },
      { href: "/profile", label: "Profile", icon: "●" },
    ],
  },
  {
    id: "community",
    label: "Community",
    hint: "Who is building what",
    items: [
      { href: "/leaderboard", label: "Leaderboard", icon: "★" },
      { href: "/participants", label: "Participants", icon: "👥" },
      { href: "/tracks", label: "Tracks", icon: "▶" },
      { href: "/visualised", label: "SAAF Visualised", icon: "▲" },
    ],
  },
  {
    id: "learn",
    label: "Learn",
    hint: "Portal guides",
    items: [
      { href: "/about", label: "About SAAF", icon: "ℹ" },
      { href: "/e-learning", label: "E-Learning", icon: "▣" },
    ],
  },
  {
    id: "build",
    label: "Build",
    hint: "Technical docs",
    items: [
      { href: "/onboarding", label: "How to Contribute", icon: "→" },
      { href: "/agent-library", label: "Agent Library", icon: "◈" },
      { href: "/open-source", label: "Open-Source Readiness", icon: "⬡" },
    ],
  },
];

export const ADMIN_ITEM: NavItem = { href: "/admin", label: "Admin", icon: "⚙" };

/** True when the current page is this item or one of its sub-pages. */
export function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** The group that holds the current page, or null when the page is not in the navigation. */
export function activeGroupId(pathname: string, groups: NavGroup[] = NAV_GROUPS): string | null {
  return groups.find((g) => g.items.some((item) => isActive(pathname, item.href)))?.id ?? null;
}
