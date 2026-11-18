import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";
import { planPath } from "./plan-path";

describe("the path of a plan", () => {
  it("is built from a plain session and slug", () => {
    expect(planPath("alignment", "auditflow-ai")).toBe("plans/alignment/auditflow-ai.md");
    expect(planPath("hackathon-2", "group-5-hackers-ai-audit-agents")).toBe("plans/hackathon-2/group-5-hackers-ai-audit-agents.md");
    // One existing plan has capitals and an underscore.
    expect(planPath("hackathon-4", "Plan_ExecSummary")).toBe("plans/hackathon-4/Plan_ExecSummary.md");
  });

  it("is refused for anything that could point somewhere else", () => {
    const refused = [
      "..",
      "../x",
      "a/b",
      "a\\b",
      "a.b",
      "a%2Fb",
      "a?b",
      "a#b",
      "a b",
      "a\nb",
      "-leading-hyphen",
      "_leading-underscore",
      "",
      "x".repeat(101),
    ];
    for (const value of refused) {
      expect(planPath(value, "auditflow-ai"), JSON.stringify(value)).toBeNull();
      expect(planPath("alignment", value), JSON.stringify(value)).toBeNull();
    }
    for (const value of [null, undefined, 42, ["alignment"], {}]) {
      expect(planPath(value, "auditflow-ai")).toBeNull();
      expect(planPath("alignment", value)).toBeNull();
    }
  });
});

describe("the response headers", () => {
  it("are set for every route", async () => {
    const rules = await nextConfig.headers?.();
    expect(rules).toHaveLength(1);
    expect(rules?.[0].source).toBe("/(.*)");
    const headers = Object.fromEntries((rules?.[0].headers ?? []).map((h) => [h.key, h.value]));
    expect(headers).toEqual({
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Strict-Transport-Security": "max-age=63072000; includeSubDomains",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    });
  });
});
