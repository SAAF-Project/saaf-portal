import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { InfoDialog } from "./InfoDialog";
import { applyRepoSignals } from "./liveAlerts";
import { STAGES } from "./stages";
import type { ProgressData } from "./types";

const data = JSON.parse(readFileSync(resolve(process.cwd(), "public/data/progress.json"), "utf8")) as ProgressData;
const html = (d: ProgressData) => renderToStaticMarkup(<InfoDialog data={d} about="About this view." viewTitle="The SAAF Temple" onClose={() => {}} />);
const text = (s: string) => s.replace(/<[^>]+>/g, "").replace(/&#x27;/g, "'").replace(/&amp;/g, "&");

describe("information screen", () => {
  it("is written from the data: every stage and every alert is explained", () => {
    const out = text(html(data));
    for (const s of STAGES) expect(out).toContain(s.label);
    for (const a of data.alert_catalog) expect(out).toContain(a.label);
  });

  it("states the weights the generator used, and the date of the data", () => {
    const out = text(html(data));
    expect(out).toContain(`complete = ${data.weights.complete}`);
    expect(out).toContain(`in progress = ${data.weights.in_progress}`);
    expect(out).toContain(`not started = ${data.weights.not_started}`);
    expect(out).toContain("38%"); // the worked example: Plan complete, Do in progress
    if (data.generated) expect(out).toContain(data.generated);
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
