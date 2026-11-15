import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import ExternalReferences, { LeavingNotice, hostOf } from "./ExternalReferences";

const refs = [
  { name: "Example guide", url: "https://guide.example.org/start", text: "How to start." },
  { name: "Example tool", url: "https://tool.example.com/", text: "A tool." },
];

describe("ExternalReferences", () => {
  it("names the host of an address", () => {
    expect(hostOf("https://guide.example.org/start")).toBe("guide.example.org");
    expect(hostOf("not an address")).toBe("not an address");
  });

  it("lists every reference with its host, marked as an external site, and opens nothing by itself", () => {
    const html = renderToStaticMarkup(<ExternalReferences references={refs} />);
    expect(html).toContain("Example guide");
    expect(html).toContain("guide.example.org · external site");
    expect(html).toContain("tool.example.com · external site");
    expect(html).not.toContain("<a ");
    expect(html).not.toContain('role="dialog"');
  });

  it("says where the member is going before the link is offered", () => {
    const html = renderToStaticMarkup(<LeavingNotice reference={refs[0]} onClose={() => {}} />);
    expect(html).toContain("You are leaving the SAAF portal.");
    expect(html).toContain("Continue to guide.example.org");
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain("Stay here");
  });
});
