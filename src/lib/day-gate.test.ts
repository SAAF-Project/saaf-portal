import { describe, expect, it } from "vitest";
import { ADMIN_USERNAME } from "./admin-auth";
import { ASSIGNMENT_OPENS_AT, ORGANISER_LOGIN, assignmentOpen, previewing, seesAssignment } from "./day-gate";
import { DAY } from "./leaderboard-day";

const before = Date.parse("2026-11-16T21:00:00Z");
const after = Date.parse("2026-11-17T08:00:00Z");

describe("the opening of the assignment", () => {
  it("is at 09:00 on the day, when the count starts", () => {
    expect(Date.parse(ASSIGNMENT_OPENS_AT)).toBe(Date.parse(DAY.start));
    expect(assignmentOpen(before)).toBe(false);
    expect(assignmentOpen(after)).toBe(true);
  });

  it("members see nothing before it, the organiser sees everything, and can look as a member", () => {
    expect(ORGANISER_LOGIN).toBe(ADMIN_USERNAME);
    expect(seesAssignment("some-member", false, before)).toBe(false);
    expect(seesAssignment(undefined, false, before)).toBe(false);
    expect(seesAssignment(ORGANISER_LOGIN, false, before)).toBe(true);
    expect(seesAssignment(ORGANISER_LOGIN, true, before)).toBe(false);
    expect(previewing(ORGANISER_LOGIN, before)).toBe(true);
    expect(previewing("some-member", before)).toBe(false);
  });

  it("is open for everyone from 09:00", () => {
    expect(seesAssignment("some-member", false, after)).toBe(true);
    expect(seesAssignment(ORGANISER_LOGIN, true, after)).toBe(true);
    expect(previewing(ORGANISER_LOGIN, after)).toBe(false);
  });
});
