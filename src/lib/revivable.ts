import { createHash } from "node:crypto";

// The agent repos a member can revive on the hardening day (17 November 2026): the repos of the organisation without
// a push between 17 August and 15 November 2026. The list is fixed: it is not worked out again from GitHub.
//
// This source is public and the names of these repos are not. So the list holds the SHA-256 hash of each repo name in
// lower case, never the name itself. Do not add a name here, in a test, in a fixture or in a commit message: tests use
// made-up names and hash those. Server-side only (Node's crypto): do not import this from a client component.

const REVIVABLE_HASHES: ReadonlySet<string> = new Set([
  "1080e8e5f79939fcfd13db742410ed22300c1286eedfed8110ad91cda5d375b3",
  "1b486e44e951f02b76aa4b9683b29ae19436e332c21c1855464ef07e95c59239",
  "1e3591b02b350762840d53c1b4ac1d86091c269b20112fc6388f9446ed887237",
  "3937c161bae6ced8e2e38b3be2dd58a9f669f6e2efceb53b7e0fe17e17fac6e8",
  "3e5bb2ce72219c1c99f0e224806dcb972212f064d590f2ae5d8438ed2e19bff9",
  "590e06302c7a82686ed8f6ec1870fb8d69dc75644912dd35d46edd997209c012",
  "6da1f57d19c6aa7150e512b01fb22d0e98b93b85dd6b8d9ee5fa036a640f8d04",
  "799400269bb503e1f72f7f389644b3cf77f1ceb97fac36796604c6b44fc52e05",
  "7a68a5b0e0663d65698df2317f6c85f6d21d3c22c4109f9fcb273add0a526c5e",
  "7d105dcdeaca3b08859e0dbdecb27f2723719f18066bccbb248ded07ff146525",
  "9b7d463841d9295a23011f1fbfc4c1729262f8912390684571ab3775a07fbdb2",
  "b80283da480ba10de3bb38aa60f142c12cfeaa72f2e0c6c7a4e77e26f1bbbcb5",
  "eb6a1052e96c695c34e8822b525d1359ac5501e9a5570c2d9dda1ff68a32b6af",
  "eb921f52126f7672eeb2d89e36bae789d5296f5508d18da381c67b1c81bc1d6f",
  "ff3e449a8bb377fa219945af78176ab740b3cede300f829cd2eb0fa534b244cf",
]);

/** The shipped list, for the tests: hashes only. */
export const revivableHashes = (): string[] => [...REVIVABLE_HASHES];

/** How a repo name is stored in the list: SHA-256 of the name in lower case, as 64 hex characters. */
export function hashRepoName(name: string): string {
  return createHash("sha256").update(name.toLowerCase(), "utf8").digest("hex");
}

/** Was this repo quiet before the hardening day? Pure; `hashes` is a parameter so a test can bring its own list. */
export function isRevivable(name: string, hashes: ReadonlySet<string> = REVIVABLE_HASHES): boolean {
  return hashes.has(hashRepoName(name));
}
