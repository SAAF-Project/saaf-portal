import { describe, expect, it } from "vitest";
import { isAllowedLogin } from "./allowed-logins";

describe("isAllowedLogin", () => {
  it("lets everyone in when the list is not set or empty", () => {
    expect(isAllowedLogin("ann", undefined)).toBe(true);
    expect(isAllowedLogin("ann", "")).toBe(true);
    expect(isAllowedLogin("ann", " , ")).toBe(true);
  });

  it("lets in only the listed logins, whatever the case or spacing", () => {
    expect(isAllowedLogin("Ann", "ann")).toBe(true);
    expect(isAllowedLogin("ann", " bob , @Ann ")).toBe(true);
    expect(isAllowedLogin("carol", "ann,bob")).toBe(false);
  });

  it("matches the whole login, not a part of it", () => {
    expect(isAllowedLogin("ann", "anna")).toBe(false);
    expect(isAllowedLogin("anna", "ann")).toBe(false);
  });
});
