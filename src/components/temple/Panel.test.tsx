import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { withAnnexPart } from "./derive";
import { Panel } from "./Panel";
import { BUNDLED_RELATIONS, cleanRelations } from "./relations";
import type { Focus, ProgressData } from "./types";

const data = withAnnexPart(JSON.parse(readFileSync(resolve(process.cwd(), "public/data/progress.json"), "utf8")) as ProgressData);
const render = (focus: Focus) => renderToStaticMarkup(<Panel data={data} focus={focus} matches={() => true} filtersActive={false} onFocus={() => {}} title="The SAAF Temple" onInfo={() => {}} onHide={() => {}} />);
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
const sections = (html: string) => [...html.matchAll(/<details class="sec"( open="")?><summary><span class="sec-title">([^<]*)/g)].map((m) => ({ title: m[2], open: m[1] !== undefined }));

describe("side panel", () => {
  it("names the overview The SAAF Temple and keeps the minor blocks folded", () => {
    const html = render({ level: "project" });
    expect(text(html)).toContain("The SAAF Temple");
    const s = sections(html);
    expect(s.find((x) => x.title === "Stages")?.open).toBe(true);
    expect(s.find((x) => x.title === "Where the work sits")?.open).toBe(true);
    expect(s.find((x) => x.title === "Types")?.open).toBe(false);
    expect(s.find((x) => x.title === "Phases")?.open).toBe(false);
  });

  it("shows the list of plans at a part, with a way back up", () => {
    const html = render({ level: "part", partId: "planning" });
    expect(text(html)).toContain("← The SAAF Temple");
    expect(sections(html).find((x) => x.title === "Plans")?.open).toBe(true);
    expect(html.match(/class="row"/g)?.length).toBe(data.parts.find((p) => p.id === "planning")!.plan_count);
  });

  it("shows only that plan when one is selected: no list, no stage mix, no project figures", () => {
    const plan = data.plans.find((p) => p.part === "planning" && p.alerts.length > 0)!;
    const html = render({ level: "plan", slug: plan.slug });
    expect(html).not.toContain('class="row"');
    expect(sections(html).map((x) => x.title)).not.toContain("Stages");
    expect(sections(html).map((x) => x.title)).not.toContain("Plans");
    expect(text(html)).toContain("← Planning");
    expect(html.match(/class="phase-pill"/g)).toHaveLength(4);
    expect(sections(html).find((x) => x.title === "Alerts")?.open).toBe(true);
    expect(sections(html).find((x) => x.title === "Placement")?.open).toBe(false);
  });

  it("says so, in one line, when a plan has no alerts", () => {
    const plan = data.plans.find((p) => p.alerts.length === 0);
    if (!plan) return;
    const html = render({ level: "plan", slug: plan.slug });
    expect(text(html)).toContain("No alerts");
    expect(sections(html).map((x) => x.title)).not.toContain("Alerts");
  });

  it("shows only the chosen repo in the annex, and the whole list otherwise", () => {
    const list = render({ level: "annex" });
    expect(list.match(/class="row"/g)).toHaveLength(data.annex.items.length);
    const item = data.annex.items[0];
    const one = render({ level: "annex", slug: item.plan });
    expect(one).not.toContain('class="row"');
    expect(text(one)).toContain("← Repo Annex");
    expect(sections(one).find((x) => x.title === "Repositories")?.open).toBe(true);
  });

  it("lists a plan's inputs and outputs, marks AI suggestions, and says so when there are none", () => {
    const { edges } = cleanRelations(BUNDLED_RELATIONS.relations, data.plans);
    const withIo = (focus: Focus, open = false) => renderToStaticMarkup(<Panel data={data} focus={focus} matches={() => true} filtersActive={false} onFocus={() => {}} title="t" onInfo={() => {}} onHide={() => {}} relations={edges} relationsOpen={open} />);
    const hub = edges.reduce((m, e) => m.set(e.to, (m.get(e.to) ?? 0) + 1), new Map<string, number>());
    const [slug, ins] = [...hub].sort((a, b) => b[1] - a[1])[0];
    const html = withIo({ level: "plan", slug }, true);
    const sec = sections(html).find((x) => x.title === "Inputs and outputs")!;
    expect(sec.open).toBe(true);
    expect(text(html)).toContain(`${ins} in`);
    expect(html.match(/class="row io-row"/g)!.length).toBe(edges.filter((e) => e.from === slug || e.to === slug).length);
    expect(text(html)).toContain("AI-suggested from the plan text");
    const loose = data.plans.find((p) => !edges.some((e) => e.from === p.slug || e.to === p.slug))!;
    expect(text(withIo({ level: "plan", slug: loose.slug }))).toContain("No documented inputs or outputs");
    expect(sections(withIo({ level: "plan", slug: loose.slug })).find((x) => x.title === "Inputs and outputs")?.open).toBe(false);
    // without relation data the section is not there at all
    expect(sections(render({ level: "plan", slug })).map((x) => x.title)).not.toContain("Inputs and outputs");
  });
});
