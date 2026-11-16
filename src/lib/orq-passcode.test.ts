import { describe, expect, it } from "vitest";
import { PASSCODE_IN_THE_ROOM, orqOnboardingText, orqPasscode } from "./orq-passcode";

describe("the Orq.ai passcode on the hardening page", () => {
  const text = `Get your own project. ${PASSCODE_IN_THE_ROOM}`;

  it("comes from the server's environment, never from the code", () => {
    expect(orqPasscode({})).toBeNull();
    expect(orqPasscode({ ORQ_PASSCODE: "  " })).toBeNull();
    expect(orqPasscode({ ORQ_PASSCODE: " made-up-123 " })).toBe("made-up-123");
    expect(orqPasscode({ ORQ_PASSCODE: "two words" })).toBeNull(); // not one word: leave the page as it is
    expect(orqPasscode({ ORQ_PASSCODE: "x".repeat(61) })).toBeNull();
  });

  it("replaces the sentence about the room only when there is a passcode", () => {
    expect(orqOnboardingText(text, null)).toBe(text);
    expect(orqOnboardingText(text, "made-up-123")).toBe("Get your own project. Passcode: made-up-123.");
  });
});
