import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { loadManifests } from "../../lib/visualisations";
import { CalculationDialog } from "./CalculationDialog";
import { applyRepoSignals } from "./liveAlerts";
import { cleanRelations, relationsFor } from "./relations";
import type { ProgressData } from "./types";

const data = JSON.parse(readFileSync(resolve(process.cwd(), "public/data/progress.json"), "utf8")) as ProgressData;
const manifests = loadManifests();
const view = (id: string) => manifests.find((m) => m.id === id)!;
const html = (d: ProgressData, id = "temple") => renderToStaticMarkup(<CalculationDialog data={d} view={view(id)} relations={cleanRelations(relationsFor(d), d.plans).edges} onClose={() => {}} />);
const text = (s: string) => s.replace(/<[^>]+>/g, "").replace(/&#x27;/g, "'").replace(/&amp;/g, "&");

describe("how this is calculated", () => {
  it("states the weights the generator used, the worked example and the date of the data", () => {
    const out = text(html(data));
    expect(out).toContain(`complete = ${data.weights.complete}`);
    expect(out).toContain(`in progress = ${data.weights.in_progress}`);
    expect(out).toContain(`not started = ${data.weights.not_started}`);
    expect(out).toContain("38%"); // the worked example: Plan complete, Do in progress
    if (data.generated) expect(out).toContain(data.generated);
  });

  it("draws the build-up of a plan's score from the same weights and links to the scoring code", () => {
    const out = html(data);
    expect(out).toContain("<svg");
    expect(text(out)).toContain("average of 4");
    expect(out).toContain("derive.ts");
    expect(out).toContain("generate_dashboard.py");
  });

  it("is short: a few lines, no stage list, no type list, no how-to-read text", () => {
    const out = text(html(data));
    expect(out.length).toBeLessThan(4500);
    expect(out).not.toContain("How to read this");
    expect(out).not.toContain("Stages, red to green");
  });

  it("keeps the alert explanations, folded away", () => {
    const out = html(data);
    expect(out).toContain("<details>");
    for (const a of data.alert_catalog) expect(text(out)).toContain(a.label);
  });

  it("says nothing about the other views", () => {
    const islands = text(html(data, "islands"));
    expect(islands).toContain("An island grows with its number of plans");
    expect(islands).not.toMatch(/temple/i);
    const temple = text(html(data, "temple"));
    expect(temple).toContain("share of the plans");
    expect(temple).not.toMatch(/island|archipelago/i);
  });

  it("shows the relations only in the view that has them", () => {
    expect(text(html(data, "dependencies"))).toContain("Inputs and outputs between plans");
    expect(text(html(data, "temple"))).not.toContain("Inputs and outputs between plans");
    expect(text(html(data, "islands"))).not.toContain("Inputs and outputs between plans");
  });

  it("says whether the live repo checks are on", () => {
    expect(text(html(data))).toContain("are not available in this view");
    const live = applyRepoSignals(data, { listed: true, repos: {}, checked_at: "2026-10-08T00:00:00Z" });
    expect(text(html(live))).toContain("checked live against GitHub");
  });

  it("no longer lists code in the main repo as an alert", () => {
    expect(data.alert_catalog.map((a) => a.id)).not.toContain("code-in-main-repo");
  });
});
