import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { ADMIN_ITEM, NAV_GROUPS, activeGroupId, isActive, pageOf } from "./navGroups";

const items = NAV_GROUPS.flatMap((g) => g.items);

describe("navigation groups", () => {
  it("has five groups, each with at least one page", () => {
    expect(NAV_GROUPS.map((g) => g.id)).toEqual(["work", "community", "visualised", "learn", "build"]);
    for (const g of NAV_GROUPS) expect(g.items.length).toBeGreaterThan(0);
  });

  it("lists every page once", () => {
    const hrefs = items.map((i) => i.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it("links only to pages that exist", () => {
    const pages = new Set(readdirSync(resolve(process.cwd(), "src/app/(authenticated)")).map((d) => `/${d}`));
    for (const item of [...items, ADMIN_ITEM]) expect(pages.has(pageOf(item.href)), item.href).toBe(true);
  });

  it("covers every page except admin, so nothing drops out of the bar", () => {
    const pages = readdirSync(resolve(process.cwd(), "src/app/(authenticated)"), { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => `/${d.name}`)
      .filter((p) => p !== ADMIN_ITEM.href);
    expect([...new Set(items.map((i) => pageOf(i.href)))].sort()).toEqual(pages.sort());
  });

  it("marks the group of the current page, sub-pages included", () => {
    expect(activeGroupId("/dashboard")).toBe("work");
    expect(activeGroupId("/visualised")).toBe("visualised");
    expect(activeGroupId("/e-learning")).toBe("learn");
    expect(activeGroupId("/agent-library/some-agent")).toBe("build");
    expect(activeGroupId("/login")).toBeNull();
  });

  it("lists one sub-item per visualisation folder, plus All views", () => {
    const folders = readdirSync(resolve(process.cwd(), "src/components/temple/views"), { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort();
    const group = NAV_GROUPS.find((g) => g.id === "visualised")!;
    const ids = group.items.map((i) => new URLSearchParams(i.href.split("?")[1] ?? "").get("view")).filter((v) => v && v !== "all");
    expect(ids.sort()).toEqual(folders);
    expect(group.items[0].href).toBe("/visualised#/?view=all");
  });

  it("does not treat a page as active for a longer route with the same start", () => {
    expect(isActive("/tracks", "/tracks")).toBe(true);
    expect(isActive("/tracks/3a", "/tracks")).toBe(true);
    expect(isActive("/tracksx", "/tracks")).toBe(false);
  });
});
