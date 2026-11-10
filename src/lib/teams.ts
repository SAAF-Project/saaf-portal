// Team matching for the Security Challenge: everyone says whether they are a hacker, a developer
// or an auditor, and the admin makes mixed teams. Every team gets at least one hacker or developer;
// where the numbers allow, a team has a hacker, a developer and an auditor.
import { shuffle } from "./demoDraw";

export const ROLES = ["hacker", "dev", "auditor"] as const;
export type Role = (typeof ROLES)[number];
export const TEAM_SIZE = 4;

export const isRole = (value: unknown): value is Role => typeof value === "string" && (ROLES as readonly string[]).includes(value);

export interface Person {
  id: string;
  role: Role;
}

/** About four people per team, but never more teams than there are hackers and developers. */
export function teamCount(people: readonly Person[]): number {
  const n = people.length;
  if (n === 0) return 0;
  const tech = people.filter((p) => p.role !== "auditor").length;
  const wanted = Math.max(1, Math.round(n / TEAM_SIZE));
  return tech === 0 ? wanted : Math.min(tech, wanted);
}

/**
 * Deal hackers round-robin, then developers continuing where the hackers stopped (so teams without a hacker
 * get a developer first), then each auditor to the smallest team with the fewest auditors.
 */
export function makeTeams(people: readonly Person[], randomInt: (maxExclusive: number) => number): string[][] {
  const count = teamCount(people);
  if (count === 0) return [];
  const teams: Person[][] = Array.from({ length: count }, () => []);
  const of = (role: Role) => shuffle(people.filter((p) => p.role === role), randomInt);

  const tech = [...of("hacker"), ...of("dev")];
  tech.forEach((p, i) => teams[i % count].push(p));

  for (const auditor of of("auditor")) {
    const minSize = Math.min(...teams.map((t) => t.length));
    const smallest = teams.filter((t) => t.length === minSize);
    const auditors = (t: Person[]) => t.filter((p) => p.role === "auditor").length;
    const fewest = Math.min(...smallest.map(auditors));
    const candidates = smallest.filter((t) => auditors(t) === fewest);
    candidates[randomInt(candidates.length)].push(auditor);
  }
  return teams.map((t) => t.map((p) => p.id));
}

/** Late arrival: the smallest team that lacks this role, otherwise the smallest team. */
export function placeLate(teams: string[][], roleOf: (id: string) => Role | undefined, person: Person): number {
  if (teams.length === 0) return -1;
  const lacks = teams.map((t, i) => ({ i, size: t.length, has: t.some((id) => roleOf(id) === person.role) }));
  const pool = lacks.some((t) => !t.has) ? lacks.filter((t) => !t.has) : lacks;
  return pool.reduce((best, t) => (t.size < best.size ? t : best)).i;
}
