import { describe, expect, it } from "vitest";
import { nextStatus, validateRequest } from "./access";
import { demoSession, linksOf, normaliseLink, normaliseLinks } from "./demo-sessions";
import { schedule } from "./demoDraw";

describe("access requests", () => {
  it("accepts a repo from the board with a reason and the creator's answer, and nothing else", () => {
    const repos = ["example-agent", "sample-service"];
    expect(validateRequest({ repo: "SAAF-Project/example-agent", reason: "revive", owner: "yes" }, repos)).toEqual({
      ok: { repo: "example-agent", reason: "revive", owner: "yes", note: "", status: "waiting", decidedAt: null },
    });
    expect(validateRequest({ repo: "other-org-repo", reason: "revive", owner: "yes" }, repos)).toEqual({ error: "Choose a repo from the board" });
    expect(validateRequest({ repo: "example-agent", reason: "admin", owner: "yes" }, repos)).toHaveProperty("error");
  });

  it("moves only forward: the organiser approves or refuses, the Mac marks it granted after gh", () => {
    expect(nextStatus("waiting", "approve")).toBe("approved");
    expect(nextStatus("approved", "granted")).toBe("granted");
    expect(nextStatus("waiting", "granted")).toBeNull(); // never granted without approval
    expect(nextStatus("granted", "refuse")).toBeNull();
    expect(nextStatus("refused", "approve")).toBe("approved");
  });
});

describe("demo sessions", () => {
  it("keeps every session apart, with the hardening day as the current one", () => {
    expect(demoSession(null)?.id).toBe("2026-11-17");
    expect(demoSession("2026-11-10")?.category).toBe("demo-2026-11");
    expect(demoSession("2026-11-17")?.category).not.toBe(demoSession("2026-11-10")?.category);
    expect(demoSession("1999-01-01")).toBeNull();
  });

  it("links only to pull requests or repos in the SAAF-Project org", () => {
    expect(normaliseLink("https://github.com/SAAF-Project/agent-template/pull/12")).toBe("https://github.com/SAAF-Project/agent-template/pull/12");
    expect(normaliseLink("")).toBe("");
    expect(normaliseLink("https://github.com/someone/else/pull/1")).toBeNull();
    expect(normaliseLink("javascript:alert(1)")).toBeNull();
    // several pull requests on one sign-up: one per line, at most five, no doubles
    const two = "https://github.com/SAAF-Project/agent-template/pull/12\nhttps://github.com/SAAF-Project/sample-service/pull/3";
    expect(normaliseLinks(two + "\n" + two.split("\n")[0] + "/")).toBe(two);
    expect(linksOf(normaliseLinks("https://github.com/SAAF-Project/a/pull/1, https://github.com/SAAF-Project/b/pull/2"))).toHaveLength(2);
    expect(normaliseLinks("")).toBe("");
    expect(normaliseLinks(two + "\nhttps://github.com/someone/else/pull/1")).toBeNull();
    expect(normaliseLinks(Array.from({ length: 6 }, (_, i) => `https://github.com/SAAF-Project/a/pull/${i + 1}`).join("\n"))).toBeNull();
  });

  it("gives six selected teams five minutes each from 16:30", () => {
    const plan = schedule(["a", "b", "c", "d", "e", "f"], { seconds: 300, start: "16:30" });
    expect(plan.slots.map((s) => s.start)).toEqual(["16:30", "16:35", "16:40", "16:45", "16:50", "16:55"]);
    expect(plan.slots.at(-1)?.end).toBe("17:00");
  });
});
