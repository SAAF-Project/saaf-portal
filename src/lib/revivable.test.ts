import { describe, expect, it } from "vitest";
import { hashRepoName, isRevivable, revivableHashes } from "./revivable";

// Made-up names only: the real names are private and this repo is public.

describe("the list of repos that can be revived", () => {
  it("holds 15 different SHA-256 hashes and nothing that looks like a name", () => {
    const hashes = revivableHashes();
    expect(hashes).toHaveLength(15);
    expect(new Set(hashes).size).toBe(15);
    for (const h of hashes) expect(h).toMatch(/^[0-9a-f]{64}$/);
  });

  it("hashes the name in lower case, as SHA-256 in hex", () => {
    // SHA-256 of the empty string and of "abc": the published test vectors of the algorithm
    expect(hashRepoName("")).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    expect(hashRepoName("ABC")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    expect(hashRepoName("Sample-Agent")).toBe(hashRepoName("sample-agent"));
  });

  it("says yes to a name whose hash is on the list, in any case, and no to every other name", () => {
    const list = new Set([hashRepoName("sample-quiet-agent")]);
    expect(isRevivable("sample-quiet-agent", list)).toBe(true);
    expect(isRevivable("Sample-Quiet-Agent", list)).toBe(true);
    expect(isRevivable("sample-quiet-agent-2", list)).toBe(false);
    expect(isRevivable("sample-busy-agent", list)).toBe(false);
  });

  it("does not have a made-up name on the shipped list", () => {
    expect(isRevivable("sample-quiet-agent")).toBe(false);
    expect(isRevivable("")).toBe(false);
  });
});
