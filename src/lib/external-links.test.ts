import { describe, expect, it } from "vitest";
import { leavesPortal, linkName } from "./external-links";

const HERE = "https://saaf-portal.vercel.app/hardening";

describe("links that leave the portal", () => {
  it("asks first for every site SAAF does not run", () => {
    expect(leavesPortal("https://saaf-project.orq.ai", HERE)?.host).toBe("saaf-project.orq.ai");
    expect(leavesPortal("https://github.com/SAAF-Project/agent-template", HERE)?.host).toBe("github.com");
    expect(leavesPortal("http://example.org/x", HERE)?.host).toBe("example.org");
  });

  it("lets links inside the portal and SAAF's own sites pass", () => {
    expect(leavesPortal("/standards", HERE)).toBeNull();
    expect(leavesPortal("https://saaf-portal.vercel.app/demo", HERE)).toBeNull();
    expect(leavesPortal("https://www.saafproject.com", HERE)).toBeNull();
    expect(leavesPortal("https://saaf-portal.vercel.app/hardening", "https://saaf-portal-git-dev-example.vercel.app/")).toBeNull();
    expect(leavesPortal("https://saafproject.com.evil.example/", HERE)?.host).toBe("saafproject.com.evil.example");
  });

  it("leaves mail, downloads of data and broken addresses alone", () => {
    expect(leavesPortal("mailto:info@saafproject.com", HERE)).toBeNull();
    expect(leavesPortal("javascript:void(0)", HERE)).toBeNull();
    expect(leavesPortal("https://", HERE)).toBeNull();
  });

  it("names a link by its own words, or by its site", () => {
    const url = new URL("https://saaf-project.orq.ai");
    expect(linkName("Get started at Orq.ai ↗", url)).toBe("Get started at Orq.ai");
    expect(linkName("  ", url)).toBe("saaf-project.orq.ai");
    expect(linkName(null, url)).toBe("saaf-project.orq.ai");
  });
});
