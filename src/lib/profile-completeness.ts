import type { UserProfile } from "@/types";

export interface ProfileCompleteness {
  percent: number;
  filled: number;
  total: number;
  missing: { key: string; label: string }[];
}

const FIELDS: { key: keyof UserProfile; label: string }[] = [
  { key: "organisation", label: "Organisation" },
  { key: "role", label: "Role" },
  { key: "preferredTrack", label: "Preferred track" },
  { key: "companyLogoUrl", label: "Company logo" },
];

export function profileCompleteness(user: UserProfile): ProfileCompleteness {
  const missing: { key: string; label: string }[] = [];
  let filled = 0;

  for (const { key, label } of FIELDS) {
    const val = user[key];
    if (val && String(val).trim().length > 0) {
      filled++;
    } else {
      missing.push({ key: String(key), label });
    }
  }

  return {
    percent: Math.round((filled / FIELDS.length) * 100),
    filled,
    total: FIELDS.length,
    missing,
  };
}
