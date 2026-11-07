import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Everything in public/ is served without login and stays in the public repo's history, so the bundled fallback copy
// must not carry personal fields. The live data (/api/progress, behind login) may still have them.
describe("bundled public/data/progress.json", () => {
  const data = JSON.parse(readFileSync(resolve(process.cwd(), "public/data/progress.json"), "utf8")) as { plans: Record<string, unknown>[] };

  it("has no submitter, organisation or claimed_by on any plan", () => {
    for (const plan of data.plans) {
      for (const field of ["submitter", "organisation", "claimed_by"]) expect(plan[field] ?? "", `${plan.slug}.${field}`).toBe("");
    }
  });
});
