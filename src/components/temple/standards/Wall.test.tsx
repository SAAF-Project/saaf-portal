import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { RepoStandards, StandardsPayload } from "../../../lib/repo-standards";
import { STAGES } from "../stages";
import { marksFromPlans, type RepoMark } from "./marks";
import { STANDARDS, type Checks } from "./standards";
import { Wall, byName } from "./Wall";

const all = (value: boolean | null): Checks => Object.fromEntries(STANDARDS.map((s) => [s.id, value]));
const repo = (name: string, checks: Checks): RepoStandards => ({ name, url: `https://github.com/SAAF-Project/${name}`, private: false, pushed_at: "2026-11-17T10:00:00Z", checks });

// synthetic repos, given out of order: one complete, one with two tiles, one whose file list could not be read
const REPOS = [repo("unread-agent", all(null)), repo("example-agent", all(true)), repo("Sample-guard", { ...all(false), readme: true, licence: true })];
const payload = (over: Partial<StandardsPayload> = {}): StandardsPayload => ({ checked_at: "2026-11-17T13:32:00Z", stale: false, ttl_seconds: 60, repos: REPOS, archived: 0, ...over });
// one synthetic plan, linked to the second repo
const MARKS = marksFromPlans([{ slug: "sample-plan", title: "Sample plan", stage: 2, repo: { name: "sample-guard", url: "", source: "mapping" }, repo_alternatives: [] }]);

const noop = () => {};
const render = (p: StandardsPayload | null, { loaded = true, selected = null as string | null, marks = MARKS as Map<string, RepoMark> } = {}) =>
  renderToStaticMarkup(<Wall payload={p} loaded={loaded} marks={marks} selected={selected} onPick={noop} onClose={noop} />);
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
const wall = (html: string) => html.split('<ul class="std-wall"')[1].split("</ul>")[0];
const faces = (html: string) => wall(html).split("</li>").filter((f) => f.includes('class="std-cell"'));
const tiles = (face: string) => [...face.matchAll(/class="std-tile" data-state="([^"]+)"/g)].map((m) => m[1]);
const nameOf = (face: string) => /data-repo="([^"]+)"/.exec(face)?.[1];

describe("standards wall", () => {
  const html = render(payload());
  const [complete, partial, unread] = faces(html);

  it("has one face per repo, in alphabetical order whatever the case, with nine tiles each", () => {
    expect(faces(html).map(nameOf)).toEqual(["example-agent", "Sample-guard", "unread-agent"]);
    for (const f of faces(html)) expect(tiles(f)).toHaveLength(STANDARDS.length);
    expect([{ name: "b" }, { name: "A" }, { name: "a" }, { name: "C" }].sort(byName).map((r) => r.name)).toEqual(["A", "a", "b", "C"]);
  });

  it("puts the tiles in the order of the nine standards, row by row", () => {
    const titles = [...partial.matchAll(/title="([^"]+): (?:in place|missing|not checked)"/g)].map((m) => m[1]);
    expect(titles).toEqual(STANDARDS.map((s) => s.label));
    expect(tiles(partial)).toEqual(["in place", "missing", "missing", "missing", "in place", "missing", "missing", "missing", "missing"]);
    expect(partial).toContain('title="README.md: in place"');
    expect(partial).toContain('title="Tests: missing"');
    expect(partial).toContain(">2/9<");
  });

  it("says not checked, never missing, for a standard without an answer", () => {
    expect(new Set(tiles(unread))).toEqual(new Set(["not checked"]));
    expect(unread).toContain('title="SECURITY.md: not checked"');
    expect(unread).toContain("0 of 9 standards in place; not checked: README.md");
    expect(unread).not.toContain("missing");
    expect(unread).toContain(">0/9<");
    // a check that is absent from the payload reads the same way
    const absent = faces(render(payload({ repos: [repo("example-agent", {})] })))[0];
    expect(new Set(tiles(absent))).toEqual(new Set(["not checked"]));
    expect(absent).not.toContain("missing");
  });

  it("marks a complete repo, and only that one", () => {
    expect(complete).toContain('data-complete="true"');
    expect(complete).toContain('aria-label="all 9 standards in place"');
    expect(complete).toContain(">9/9<");
    expect(new Set(tiles(complete))).toEqual(new Set(["in place"]));
    for (const f of [partial, unread]) expect(f).not.toContain("data-complete");
  });

  it("shows the stage of the linked plan next to the count, and nothing for a repo without a plan", () => {
    expect(partial).toContain(`class="std-stage" style="background:${STAGES[2].color}"`);
    expect(text(partial)).toContain(`linked to a plan in the stage ${STAGES[2].label}`);
    for (const f of [complete, unread]) expect(f).not.toContain("std-stage");
  });

  it("sums the tiles in one line above the wall, with the time of the check", () => {
    const head = text(html.split('<div class="std-scroll"')[0]);
    expect(head).toMatch(/11 of 27 tiles in place · 1 repo complete · checked \d\d:\d\d/);
    expect(head).toContain("3 repos on the board · 9 tiles not checked");
    expect(head).not.toContain("may be behind");
    expect(text(render(payload({ stale: true, archived: 2 })))).toContain("2 archived repos left out · GitHub did not answer the last check, so this may be behind");
  });

  it("names the nine positions in a key, which folds away on a narrow screen", () => {
    const key = html.split('<div class="std-key std-key-wide">')[1].split("</div>")[0];
    expect([...key.matchAll(/<li title="[^"]+">([^<]+)<\/li>/g)].map((m) => m[1])).toEqual(STANDARDS.map((s) => s.label));
    for (const state of ["in place", "missing", "not checked"]) expect(key).toContain(`data-state="${state}"`);
    expect(html).toContain('<details class="std-key std-key-narrow"><summary>');
  });

  it("shows one calm line and no faces when there is no answer", () => {
    for (const none of [render(payload({ repos: null, checked_at: null, archived: null })), render(null)]) {
      expect(text(none)).toContain("The standards have no answer from GitHub right now. The picture tries again every minute.");
      expect(none).not.toContain("std-cell");
      expect(none).not.toContain("std-tile");
      expect(text(none)).not.toContain("tiles in place");
    }
    const waiting = render(null, { loaded: false });
    expect(text(waiting)).toContain("Checking the repos.");
    expect(waiting).not.toContain("std-cell");
  });
});

describe("the selected repo", () => {
  it("is not there until a face is picked", () => {
    const html = render(payload());
    expect(html).not.toContain("std-detail");
    expect(html.match(/aria-pressed="true"/g)).toBeNull();
  });

  it("lists its nine standards by name, with the state in words", () => {
    const html = render(payload(), { selected: "Sample-guard" });
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(1);
    expect(faces(html).find((f) => f.includes('aria-pressed="true"'))).toContain('data-repo="Sample-guard"');
    const detail = html.split('<section class="std-detail"')[1];
    const rows = [...detail.matchAll(/<li data-state="([^"]+)"[^>]*>.*?class="std-check-name">([^<]+)<.*?class="std-check-state">([^<]+)</g)].map((m) => [m[2], m[1], m[3]]);
    expect(rows.map((r) => r[0])).toEqual(STANDARDS.map((s) => s.label));
    expect(rows[0]).toEqual(["README.md", "in place", "in place"]);
    expect(rows[5]).toEqual(["Tests", "missing", "missing"]);
    expect(text(detail)).toContain("2 of 9 in place");
    expect(text(detail)).toContain(`Plan: Sample plan · ${STAGES[2].label}`);
    expect(detail).toContain('href="https://github.com/SAAF-Project/Sample-guard"');
  });

  it("says so when no plan links to the repo, and keeps not checked apart from missing", () => {
    const detail = render(payload(), { selected: "unread-agent" }).split('<section class="std-detail"')[1];
    expect(text(detail)).toContain("No plan links to this repo.");
    expect(text(detail)).toContain("0 of 9 in place · 9 not checked");
    expect(detail.match(/class="std-check-state">not checked</g)).toHaveLength(STANDARDS.length);
    expect(detail).not.toContain("missing");
  });

  it("is dropped quietly when the repo is no longer on the wall", () => {
    expect(render(payload(), { selected: "removed-agent" })).not.toContain("std-detail");
  });
});
