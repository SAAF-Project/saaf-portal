import { describe, expect, it } from "vitest";
import type { RepoRef } from "../types";
import { marksFromPlans, repoForPlan, repoKey } from "./marks";

const ref = (name: string): RepoRef => ({ name, url: `https://github.com/SAAF-Project/${name}`, source: "mapping" });
const plan = (slug: string, stage: number, repo: string | null, alternatives: string[] = [], title = `Plan ${slug}`) => ({
  slug,
  title,
  stage,
  repo: repo ? ref(repo) : null,
  repo_alternatives: alternatives.map(ref),
});

// synthetic plans and repos
const PLANS = [
  plan("example-plan", 2, "example-agent", ["example-agent-old"]),
  plan("sample-plan", 4, "sample-guard"),
  plan("paper-plan", 0, null),
];

describe("marksFromPlans", () => {
  const marks = marksFromPlans(PLANS);

  it("links a repo to the plan that names it as its own repo", () => {
    expect(marks.get("example-agent")).toEqual({ slug: "example-plan", title: "Plan example-plan", stage: 2, primary: true });
    expect(marks.get("sample-guard")).toEqual({ slug: "sample-plan", title: "Plan sample-plan", stage: 4, primary: true });
  });

  it("links a repo that a plan lists as an alternative, and says it is one", () => {
    expect(marks.get("example-agent-old")).toEqual({ slug: "example-plan", title: "Plan example-plan", stage: 2, primary: false });
  });

  it("has nothing for a repo no plan names, and nothing for a plan without a repo", () => {
    expect(marks.get(repoKey("demo-service"))).toBeUndefined();
    expect(marks.size).toBe(3);
    expect(marksFromPlans([]).size).toBe(0);
  });

  it("matches on the bare name, whatever the case or the owner in front", () => {
    const loose = marksFromPlans([plan("example-plan", 1, "SAAF-Project/Example-Agent")]);
    expect(loose.get(repoKey("example-agent"))?.slug).toBe("example-plan");
    expect(repoKey(" Example-Agent ")).toBe("example-agent");
    expect(repoKey("SAAF-Project/Example-Agent")).toBe("example-agent");
  });

  it("lets a plan's own repo win over another plan's alternative, in either order", () => {
    const own = plan("owner-plan", 3, "shared-agent");
    const other = plan("other-plan", 1, "other-agent", ["shared-agent"]);
    expect(marksFromPlans([own, other]).get("shared-agent")?.slug).toBe("owner-plan");
    expect(marksFromPlans([other, own]).get("shared-agent")).toMatchObject({ slug: "owner-plan", primary: true });
  });

  it("keeps the first plan when two make the same claim, so the answer is stable", () => {
    const first = plan("first-plan", 1, "shared-agent");
    const second = plan("second-plan", 5, "shared-agent");
    expect(marksFromPlans([first, second]).get("shared-agent")?.slug).toBe("first-plan");
  });

  it("uses the slug when a plan has no title", () => {
    expect(marksFromPlans([plan("untitled-plan", 0, "example-agent", [], "")]).get("example-agent")?.title).toBe("untitled-plan");
  });
});

describe("repoForPlan", () => {
  const marks = marksFromPlans(PLANS);

  it("gives the plan's own repo when it is on the wall", () => {
    expect(repoForPlan(["example-agent-old", "example-agent", "sample-guard"], marks, "example-plan")).toBe("example-agent");
  });

  it("falls back to an alternative when the plan's own repo is not on the wall", () => {
    expect(repoForPlan(["example-agent-old", "sample-guard"], marks, "example-plan")).toBe("example-agent-old");
  });

  it("gives nothing for a plan without a repo on the wall", () => {
    expect(repoForPlan(["sample-guard"], marks, "example-plan")).toBeUndefined();
    expect(repoForPlan(["example-agent"], marks, "paper-plan")).toBeUndefined();
    expect(repoForPlan([], marks, "sample-plan")).toBeUndefined();
  });
});
