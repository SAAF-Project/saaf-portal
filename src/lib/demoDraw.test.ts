import { describe, expect, it } from "vitest";
import { clock, normaliseRepo, schedule, secondsPerTeam, shuffle } from "./demoDraw";

describe("demo draw", () => {
  it("gives at most five minutes, and less when more teams sign up", () => {
    expect(secondsPerTeam(1)).toBe(300);
    expect(secondsPerTeam(6)).toBe(300);
    expect(secondsPerTeam(7)).toBe(240);
    expect(secondsPerTeam(8)).toBe(210);
    expect(secondsPerTeam(10)).toBe(180);
    expect(secondsPerTeam(12)).toBe(150);
  });

  it("never runs past 17:00", () => {
    for (let n = 1; n <= 60; n++) expect(n * secondsPerTeam(n)).toBeLessThanOrEqual(1800);
  });

  it("writes clock times with seconds only when needed", () => {
    expect(clock(0)).toBe("16:30");
    expect(clock(210)).toBe("16:33:30");
    expect(clock(1800)).toBe("17:00");
  });

  it("schedules back to back from 16:30", () => {
    const { seconds, slots } = schedule(["a", "b", "c", "d", "e", "f", "g", "h"]);
    expect(seconds).toBe(210);
    expect(slots[0]).toEqual({ start: "16:30", end: "16:33:30", item: "a" });
    expect(slots[7].end).toBe("16:58");
  });

  it("shuffles into a permutation of the same teams", () => {
    let seed = 7;
    const rnd = (max: number) => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed % max;
    };
    const teams = ["a", "b", "c", "d", "e"];
    const out = shuffle(teams, rnd);
    expect([...out].sort()).toEqual(teams);
    expect(teams).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("accepts only repositories in the SAAF-Project org", () => {
    expect(normaliseRepo("")).toBe("");
    expect(normaliseRepo("my-guard")).toBe("SAAF-Project/my-guard");
    expect(normaliseRepo("SAAF-Project/my-guard")).toBe("SAAF-Project/my-guard");
    expect(normaliseRepo("https://github.com/SAAF-Project/my-guard/tree/main")).toBe("SAAF-Project/my-guard");
    expect(normaliseRepo("github.com/saaf-project/my-guard.git")).toBe("SAAF-Project/my-guard");
    expect(normaliseRepo("https://github.com/evil/my-guard")).toBeNull();
    expect(normaliseRepo("https://gitlab.com/SAAF-Project/x")).toBeNull();
    expect(normaliseRepo("..")).toBeNull();
    expect(normaliseRepo("a b")).toBeNull();
  });
});
