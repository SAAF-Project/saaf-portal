import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { isPlans, loadPlans } from "./progress-data";

const read = (file: string) => JSON.parse(readFileSync(resolve(process.cwd(), file), "utf8"));
const PERSONAL = ["submitter", "organisation", "claimed_by"];

// Plan data is for logged-in users only (#8). Everything in public/ is served without login, and everything in this
// repo stays in its public history, so the bundled fallback copies in data/ must not carry personal fields. The live
// data (read from the private SAAF-Project repo behind login) may still have them.
describe("bundled plan data", () => {
  it("is no longer in public/", () => {
    for (const file of ["plans.json", "submitters.json", "progress.json"]) {
      expect(existsSync(resolve(process.cwd(), "public/data", file)), `public/data/${file}`).toBe(false);
    }
  });

  it("has no submitter, organisation or claimed_by in data/plans.json or data/progress.json", () => {
    for (const file of ["data/plans.json", "data/progress.json"]) {
      const plans = file.endsWith("progress.json") ? read(file).plans : read(file);
      for (const plan of plans as Record<string, unknown>[]) {
        for (const field of PERSONAL) expect(plan[field] ?? "", `${file} ${plan.slug}.${field}`).toBe("");
      }
    }
  });

  it("ships an empty submitter list", () => {
    expect(read("data/submitters.json")).toEqual([]);
  });
});

describe("loadPlans", () => {
  it("falls back to the bundled copy without a token", async () => {
    const before = process.env.GITHUB_PAT;
    delete process.env.GITHUB_PAT;
    const loaded = await loadPlans();
    if (before !== undefined) process.env.GITHUB_PAT = before;
    expect(loaded.source).toBe("bundled");
    expect(isPlans(loaded.data)).toBe(true);
  });

  it("uses the live copy when GitHub answers with a valid list", async () => {
    const before = process.env.GITHUB_PAT;
    process.env.GITHUB_PAT = "test-token";
    const fake = (async () => new Response(JSON.stringify([{ slug: "live-plan" }]), { status: 200 })) as unknown as typeof fetch;
    const loaded = await loadPlans(fake);
    if (before === undefined) delete process.env.GITHUB_PAT;
    else process.env.GITHUB_PAT = before;
    expect(loaded).toEqual({ data: [{ slug: "live-plan" }], source: "live" });
  });
});
