import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { loadManifests } from "../../lib/visualisations";
import { DisplayMenu } from "./DisplayMenu";
import { ViewChooser } from "./ViewChooser";
import { buildViews } from "./views";

const views = buildViews(loadManifests());
const noop = () => {};

describe("view chooser", () => {
  const html = renderToStaticMarkup(<ViewChooser views={views} onPick={noop} />);
  it("says in a few words what the page is, before the tiles", () => {
    expect(html).toContain("visual representation of the SAAF-Project repositories");
    expect(html.indexOf("visual representation")).toBeLessThan(html.indexOf("chooser-tiles"));
  });
  it("has one tile per view with its name, description and preview", () => {
    expect(html.match(/<button class="chooser-tile/g)?.length).toBe(views.length);
    for (const v of views) {
      expect(html).toContain(`<b>${v.name}</b>`);
      expect(html).toContain(v.description.replace(/'/g, "&#x27;"));
      expect(html).toContain(`src="${v.previewUrl}"`);
    }
  });
});

describe("display menu", () => {
  const menu = (options: ("scenery" | "style")[], theme = false) =>
    renderToStaticMarkup(<DisplayMenu options={options} scenery style="clean" onScenery={noop} onStyle={noop} theme="dark" onToggleTheme={theme ? noop : undefined} />);
  it("is not there at all when the view has nothing to set", () => {
    expect(menu([])).toBe("");
  });
  it("is one button that opens a menu, and it is the Display target of the tour", () => {
    const html = menu(["scenery", "style"]);
    expect(html).toContain("Display");
    expect(html).toContain('data-tour="display"');
    expect(html).toContain('aria-expanded="false"');
  });
  it("still shows when only the host's theme switch is there", () => {
    expect(menu([], true)).toContain("Display");
  });
});
