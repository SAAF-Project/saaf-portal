import { describe, expect, it } from "vitest";
import { makeTeams, placeLate, teamCount, type Person, type Role } from "./teams";

// Small seeded random source so the tests are repeatable.
function seeded(seed: number) {
  let s = seed;
  return (max: number) => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s % max;
  };
}

const crowd = (h: number, d: number, a: number): Person[] => [
  ...Array.from({ length: h }, (_, i) => ({ id: `h${i}`, role: "hacker" as Role })),
  ...Array.from({ length: d }, (_, i) => ({ id: `d${i}`, role: "dev" as Role })),
  ...Array.from({ length: a }, (_, i) => ({ id: `a${i}`, role: "auditor" as Role })),
];

describe("teamCount", () => {
  it("aims at about four per team", () => {
    expect(teamCount(crowd(4, 4, 8))).toBe(4);
    expect(teamCount(crowd(1, 1, 1))).toBe(1);
  });
  it("never makes more teams than hackers plus developers", () => {
    expect(teamCount(crowd(1, 1, 18))).toBe(2);
  });
  it("still makes teams when nobody is technical", () => {
    expect(teamCount(crowd(0, 0, 8))).toBe(2);
    expect(teamCount([])).toBe(0);
  });
});

describe("makeTeams", () => {
  for (const [h, d, a] of [[7, 5, 12], [3, 6, 20], [2, 1, 9], [7, 0, 3], [0, 4, 10], [10, 10, 2]]) {
    it(`puts a hacker or developer in every team (${h} hackers, ${d} devs, ${a} auditors)`, () => {
      const people = crowd(h, d, a);
      const teams = makeTeams(people, seeded(h * 100 + d * 10 + a));
      const all = teams.flat();
      expect(all.sort()).toEqual(people.map((p) => p.id).sort());
      for (const t of teams) expect(t.some((id) => !id.startsWith("a"))).toBe(true);
      const sizes = teams.map((t) => t.length);
      expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
    });
  }

  it("mixes a hacker, a developer and an auditor when the numbers allow", () => {
    const teams = makeTeams(crowd(4, 4, 8), seeded(7));
    for (const t of teams) {
      expect(t.some((id) => id.startsWith("h"))).toBe(true);
      expect(t.some((id) => id.startsWith("d"))).toBe(true);
      expect(t.some((id) => id.startsWith("a"))).toBe(true);
    }
  });

  it("gives teams without a hacker a developer first", () => {
    const teams = makeTeams(crowd(2, 2, 12), seeded(3));
    expect(teams).toHaveLength(4);
    for (const t of teams) expect(t.filter((id) => !id.startsWith("a"))).toHaveLength(1);
  });
});

describe("placeLate", () => {
  const role = (id: string): Role => (id.startsWith("h") ? "hacker" : id.startsWith("d") ? "dev" : "auditor");
  it("prefers the smallest team that lacks the role", () => {
    const teams = [["h0", "d0", "a0"], ["h1", "a1"], ["d1", "a2", "a3"]];
    expect(placeLate(teams, role, { id: "h9", role: "hacker" })).toBe(2);
    expect(placeLate(teams, role, { id: "d9", role: "dev" })).toBe(1);
    expect(placeLate(teams, role, { id: "a9", role: "auditor" })).toBe(1);
  });
});
