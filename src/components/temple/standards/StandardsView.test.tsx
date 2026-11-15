import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { RepoStandards, StandardsPayload } from "../../../lib/repo-standards";
import { STANDARDS, type Checks } from "./standards";
import StandardsView from "./StandardsView";
import { summarise, summaryNotes, summaryParts } from "./summary";
import { keepOnFail } from "./useStandards";

const all = (value: boolean | null): Checks => Object.fromEntries(STANDARDS.map((s) => [s.id, value]));
const repo = (name: string, checks: Checks): RepoStandards => ({ name, url: `https://github.com/SAAF-Project/${name}`, private: false, pushed_at: "2026-11-17T10:00:00Z", created_at: "2026-10-01T00:00:00Z", checks });

// synthetic repos: one complete, one with two tiles, one whose file list could not be read
const REPOS = [repo("example-agent", all(true)), repo("sample-service", { ...all(false), readme: true, licence: true }), repo("unread-agent", all(null))];
const payload = (over: Partial<StandardsPayload> = {}): StandardsPayload => ({ checked_at: "2026-11-17T13:32:00Z", stale: false, ttl_seconds: 60, repos: REPOS, archived: 0, ...over });

const render = (p: StandardsPayload | null, loaded = true) => renderToStaticMarkup(<StandardsView payload={p} loaded={loaded} />);
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
const rows = (html: string) => html.split("<tbody>")[1].split("</tbody>")[0].split("</tr>").filter((r) => r.includes("<tr"));
const marks = (row: string) => [...row.matchAll(/data-state="([^"]+)"/g)].map((m) => m[1]);

describe("standards board", () => {
  const html = render(payload());

  it("has one row per repo, in the order given, and one mark per standard", () => {
    const body = rows(html);
    expect(body).toHaveLength(3);
    expect(body.map((r) => /<a [^>]*>([^<]+)<\/a>/.exec(r)?.[1])).toEqual(["example-agent", "sample-service", "unread-agent"]);
    for (const r of body) expect(marks(r)).toHaveLength(STANDARDS.length);
    expect(html.match(/<th scope="col"/g)).toHaveLength(STANDARDS.length + 2);
  });

  it("draws in place, missing and not checked as three different marks", () => {
    const [complete, partial, unread] = rows(html);
    expect(new Set(marks(complete))).toEqual(new Set(["in place"]));
    expect(marks(partial).filter((m) => m === "in place")).toHaveLength(2);
    expect(marks(partial).filter((m) => m === "missing")).toHaveLength(7);
    expect(partial).toContain('aria-label="README.md: in place"');
    expect(partial).toContain('aria-label="Tests: missing"');
    expect(partial).toContain("bg-accent");
    expect(unread).toContain("border-dashed");
  });

  it("says not checked, never missing, for a standard without an answer", () => {
    const unread = rows(html)[2];
    expect(new Set(marks(unread))).toEqual(new Set(["not checked"]));
    expect(unread).toContain('aria-label="SECURITY.md: not checked"');
    expect(unread).not.toContain("missing");
    expect(unread).toContain(">0/9<");
    // a check that is absent from the payload reads the same way
    const absent = rows(render(payload({ repos: [repo("example-agent", {})] })))[0];
    expect(new Set(marks(absent))).toEqual(new Set(["not checked"]));
  });

  it("marks a complete repo, and only that one", () => {
    const [complete, partial, unread] = rows(html);
    expect(complete).toContain('data-complete="true"');
    expect(text(complete)).toContain("complete");
    expect(complete).toContain(">9/9<");
    for (const r of [partial, unread]) {
      expect(r).not.toContain("data-complete");
      expect(text(r)).not.toContain("complete");
    }
  });

  it("sums the tiles in one line, with the time of the check", () => {
    expect(text(html)).toMatch(/11 of 27 tiles in place · 1 repo complete · checked \d\d:\d\d/);
    expect(text(html)).toContain("3 repos on the board · 9 tiles not checked");
    expect(text(html)).not.toContain("archived");
    expect(text(html)).not.toContain("may be behind");
  });

  it("says so when it shows an earlier result", () => {
    const stale = text(render(payload({ stale: true, archived: 2 })));
    expect(stale).toContain("2 archived repos left out");
    expect(stale).toContain("GitHub did not answer the last check, so this may be behind");
  });

  it("shows one calm line and no table when there is no board", () => {
    for (const none of [render(payload({ repos: null, checked_at: null, archived: null })), render(null)]) {
      expect(text(none)).toContain("The board has no answer from GitHub right now. It tries again every minute.");
      expect(none).not.toContain("<table");
      expect(text(none)).not.toContain("tiles in place");
    }
    const waiting = render(null, false);
    expect(text(waiting)).toContain("Checking the repos.");
    expect(waiting).not.toContain("<table");
  });
});

describe("board summary", () => {
  it("counts tiles, repos and what could not be checked", () => {
    expect(summarise(REPOS)).toEqual({ repos: 3, tiles: 27, met: 11, unknown: 9, complete: 1 });
    expect(summarise([])).toEqual({ repos: 0, tiles: 0, met: 0, unknown: 0, complete: 0 });
  });

  it("writes the line in plain words, singular and plural", () => {
    expect(summaryParts({ repos: 45, tiles: 405, met: 212, unknown: 0, complete: 6 }, "14:32")).toEqual(["212 of 405 tiles in place", "6 repos complete", "checked 14:32"]);
    expect(summaryParts({ repos: 1, tiles: 9, met: 9, unknown: 0, complete: 1 }, null)).toEqual(["9 of 9 tiles in place", "1 repo complete"]);
    expect(summaryNotes({ repos: 45, tiles: 405, met: 212, unknown: 0, complete: 6 }, 0)).toEqual(["45 repos on the board"]);
    expect(summaryNotes({ repos: 1, tiles: 9, met: 0, unknown: 1, complete: 0 }, 1)).toEqual(["1 repo on the board", "1 tile not checked", "1 archived repo left out"]);
  });
});

describe("keepOnFail", () => {
  const shown = payload();
  it("keeps what is on screen when a poll fails", () => {
    expect(keepOnFail(shown, null)).toBe(shown);
    expect(keepOnFail(null, null)).toBeNull();
  });
  it("keeps the board, marked stale, when a poll comes back without one", () => {
    expect(keepOnFail(shown, payload({ repos: null, checked_at: null, archived: null }))).toEqual({ ...shown, stale: true });
  });
  it("takes a fresh answer, and the first answer whatever it is", () => {
    const fresh = payload({ checked_at: "2026-11-17T13:33:00Z" });
    expect(keepOnFail(shown, fresh)).toBe(fresh);
    const none = payload({ repos: null });
    expect(keepOnFail(null, none)).toBe(none);
  });
});
