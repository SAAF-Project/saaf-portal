import { describe, expect, it } from "vitest";
import { BADGE_KEYS, computeBadge } from "./achievements";

describe("the Reviver badge", () => {
  it("is one of the badges, with three levels at 1, 2 and 3 revived agents", () => {
    expect(BADGE_KEYS).toContain("revived");
    const badge = computeBadge("revived", 0);
    expect(badge.title).toBe("Reviver");
    expect(badge.levels.map((l) => l.threshold)).toEqual([1, 2, 3]);
    expect(badge.levels.map((l) => l.label)).toEqual(["Bronze", "Silver", "Gold"]);
    expect(badge.howToEarn).toContain("Becoming owner alone does not count.");
  });

  it("is not earned at 0, level 1 at 1, level 2 at 2 and level 3 at 3 or more", () => {
    const none = computeBadge("revived", 0);
    expect(none.level).toBe(0);
    expect(none.currentLevelData).toBeNull();
    expect(none.nextLevelData?.threshold).toBe(1);

    const one = computeBadge("revived", 1);
    expect(one.level).toBe(1);
    expect(one.count).toBe(1);
    expect(one.nextLevelData?.threshold).toBe(2);

    expect(computeBadge("revived", 2).level).toBe(2);

    const three = computeBadge("revived", 3);
    expect(three.level).toBe(3);
    expect(three.nextLevelData).toBeNull();
    expect(computeBadge("revived", 7).level).toBe(3);
  });

  it("has no dash in its texts", () => {
    const { title, description, howToEarn } = computeBadge("revived", 0);
    expect(`${title} ${description} ${howToEarn}`).not.toMatch(/[–—]/);
  });
});
