import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import RevivedModal, { RevivedDialog, listNames, revivedHeadline } from "./RevivedModal";

const noop = () => {};
const html = (repos: string[]) => renderToStaticMarkup(<RevivedDialog repos={repos} onClose={noop} />);
const text = (s: string) => s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

describe("the message for a revived agent", () => {
  it("says it in the singular for one agent and names the repo", () => {
    const out = html(["sample-quiet-agent"]);
    expect(out).toContain("You revived an agent.");
    expect(out).toContain("sample-quiet-agent");
    expect(out).toContain("It is on the standards board with all nine tiles, and your name is on it.");
  });

  it("says it in the plural for more agents and names every repo", () => {
    const out = html(["sample-quiet-agent", "sample-quiet-service"]);
    expect(out).toContain("You revived 2 agents.");
    expect(out).toContain("sample-quiet-agent and sample-quiet-service");
    expect(out).toContain("They are on the standards board with all nine tiles, and your name is on them.");
    expect(html(["a-agent", "b-agent", "c-agent"])).toContain("You revived 3 agents.");
    expect(html(["a-agent", "b-agent", "c-agent"])).toContain("a-agent, b-agent and c-agent");
  });

  it("is a labelled modal dialog with a link to the standards board and a close button", () => {
    const out = html(["sample-quiet-agent"]);
    expect(out).toContain('role="dialog"');
    expect(out).toContain('aria-modal="true"');
    const labelledBy = /aria-labelledby="([^"]+)"/.exec(out)?.[1];
    expect(labelledBy).toBeTruthy();
    expect(out).toMatch(new RegExp(`<h2[^>]*id="${labelledBy}"[^>]*>You revived an agent\\.</h2>`));
    expect(out).toMatch(/<a[^>]*href="\/standards"/);
    expect(out).toMatch(/<button[^>]*type="button"[^>]*>Close<\/button>/);
  });

  it("fades in only for people who have not asked for less motion", () => {
    expect(html(["sample-quiet-agent"])).toContain("motion-safe:animate-fade-in");
  });

  it("has sentence-case text that ends with a full stop, without dashes or emoji", () => {
    const out = text(html(["sample-quiet-agent", "sample-quiet-service"]));
    expect(out).not.toMatch(/[–—]/);
    expect(out).not.toMatch(/\p{Extended_Pictographic}/u);
    expect(revivedHeadline(1)).toBe("You revived an agent.");
    expect(revivedHeadline(2)).toBe("You revived 2 agents.");
    expect(listNames(["a"])).toBe("a");
  });
});

describe("when the message shows", () => {
  const gate = (login: string | undefined, repos: string[] | undefined) => renderToStaticMarkup(<RevivedModal login={login} repos={repos} />);

  it("shows nothing without a login or without a revived agent", () => {
    expect(gate(undefined, ["sample-quiet-agent"])).toBe("");
    expect(gate("ann", [])).toBe("");
    expect(gate("ann", undefined)).toBe("");
  });

  it("shows when the member has revived more than they last saw (nothing is remembered here)", () => {
    expect(gate("ann", ["sample-quiet-agent"])).toContain("You revived an agent.");
  });
});
