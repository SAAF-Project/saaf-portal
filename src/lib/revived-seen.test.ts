import { describe, expect, it } from "vitest";
import { rememberSeen, seenCount } from "./revived-seen";

function fakeStorage(initial: Record<string, string> = {}) {
  const items = new Map(Object.entries(initial));
  return {
    items,
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
  };
}
const broken = {
  getItem: (): string | null => {
    throw new Error("storage is blocked");
  },
  setItem: (): void => {
    throw new Error("storage is blocked");
  },
};

describe("the revived count a member last saw", () => {
  it("is 0 until something is remembered, and is kept per login, whatever its case", () => {
    const storage = fakeStorage();
    expect(seenCount("ann", storage)).toBe(0);
    rememberSeen("Ann", 1, storage);
    expect(seenCount("ann", storage)).toBe(1);
    expect(seenCount("ANN", storage)).toBe(1);
    expect(seenCount("bob", storage)).toBe(0);
    expect([...storage.items.keys()]).toEqual(["saaf-revived-seen:ann"]);
  });

  it("only goes up, so a count that drops for a while does not bring the message back", () => {
    const storage = fakeStorage();
    rememberSeen("ann", 2, storage);
    rememberSeen("ann", 0, storage);
    rememberSeen("ann", 1, storage);
    expect(seenCount("ann", storage)).toBe(2);
    rememberSeen("ann", 3, storage);
    expect(seenCount("ann", storage)).toBe(3);
  });

  it("reads anything that is not a positive number as 0", () => {
    for (const value of ["", "abc", "-2", "NaN"]) expect(seenCount("ann", fakeStorage({ "saaf-revived-seen:ann": value }))).toBe(0);
  });

  it("works without storage: 0, and remembering does nothing and does not throw", () => {
    expect(seenCount("ann", null)).toBe(0);
    expect(() => rememberSeen("ann", 1, null)).not.toThrow();
    expect(seenCount("ann", broken)).toBe(0);
    expect(() => rememberSeen("ann", 1, broken)).not.toThrow();
    expect(seenCount("ann")).toBe(0); // no window here, as on the server
  });
});
