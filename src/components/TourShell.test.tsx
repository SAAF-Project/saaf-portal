import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TourShell, cardPosition, type TourStepContent } from "./TourShell";

const steps: TourStepContent[] = [
  { title: "First", body: <p>one</p> },
  { title: "Second", body: <p>two</p>, target: "filters" },
  { title: "Third", body: <p>three</p> },
];
const noop = () => {};
const render = (step: number, extra: { finishLabel?: string; skipLabel?: string } = {}) => renderToStaticMarkup(<TourShell steps={steps} step={step} onStep={noop} onClose={noop} {...extra} />);

describe("the shared step-by-step guide", () => {
  it("shows the title, the body and one progress bar segment per step", () => {
    const html = render(0);
    expect(html).toContain("First");
    expect(html).toContain("<p>one</p>");
    expect(html.match(/h-1\.5 /g)?.length).toBe(3);
    expect(html.match(/bg-accent/g)?.length).toBe(1); // only the first step is reached
    expect(render(2).match(/bg-accent/g)?.length).toBe(3);
  });

  it("cannot go back from the first step and offers Next until the last", () => {
    expect(render(0)).toMatch(/disabled=""[^>]*>← Back/);
    expect(render(0)).toContain("Next →");
    expect(render(1)).not.toMatch(/disabled=""[^>]*>← Back/);
    expect(render(2)).not.toContain("Next →");
  });

  it("has a button on the last step only when it is given a label (the wizard brings its own)", () => {
    expect(render(2)).not.toContain("Done");
    expect(render(2, { finishLabel: "Done" })).toContain("Done");
    expect(render(0, { finishLabel: "Done" })).not.toContain(">Done<");
  });

  it("always offers a way out, with a label the host can change", () => {
    expect(render(1)).toContain("Skip for now");
    expect(render(1, { skipLabel: "Skip tour" })).toContain("Skip tour");
  });

  it("a step without a target is a centred dialog over a dimmed page; with a target it does not block the page", () => {
    expect(render(0)).toContain('aria-modal="true"');
    expect(render(0)).toContain("backdrop-blur");
    expect(render(1)).toContain('aria-modal="false"');
    expect(render(1)).toContain("pointer-events-none");
  });

  it("is labelled by its title, for screen readers", () => {
    expect(renderToStaticMarkup(<TourShell steps={steps} step={0} onStep={noop} onClose={noop} labelId="my-title" />)).toContain('aria-labelledby="my-title"');
  });
});

describe("where the card goes next to a highlighted box", () => {
  const viewport = { width: 1440, height: 900 };
  it("sits below the box, centred on it", () => {
    const pos = cardPosition({ top: 50, left: 600, width: 100, height: 40 }, viewport);
    expect(pos.top).toBe(50 + 40 + 12);
    expect(pos.left).toBe(600 + 50 - 180);
  });
  it("moves above the box when there is no room below", () => {
    const pos = cardPosition({ top: 800, left: 600, width: 100, height: 40 }, viewport, 220);
    expect(pos.top).toBe(800 - 220 - 12);
  });
  it("stays inside the window at the edges", () => {
    expect(cardPosition({ top: 50, left: 0, width: 40, height: 40 }, viewport).left).toBe(12);
    expect(cardPosition({ top: 50, left: 1400, width: 40, height: 40 }, viewport).left).toBe(1440 - 360 - 12);
  });
});
