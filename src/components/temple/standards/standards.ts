// The nine standards every agent and shared service is taken through (Session 11, the hardening day).
// One list, read by the handout page (/hardening) and by the board (/standards). Each rule looks only at a repo's file
// list (one git/trees/HEAD?recursive=1 call), so the board can check a repo without reading any file.
// Pure: no React and no imports, so the server, the pages and the tests can all use it.

/** One file of a repo: its path from the repo root and its size in bytes. */
export interface TreeFile {
  path: string;
  size: number;
}

export interface Standard {
  id: string;
  label: string;
  /** Where the board looks for it, in words. */
  file: string;
  why: string;
  check: (files: TreeFile[]) => boolean;
}

/** `null` = not checked: the file list was cut off or could not be read. Never shown as missing. */
export type Checks = Record<string, boolean | null>;

/** A README shorter than this many bytes is a placeholder, not a description of the agent. */
export const README_MIN_BYTES = 500;

/** Paths that count as a test, in the common layouts. Also used by the live alerts (src/lib/repo-signals.ts). */
export const TEST_PATH = /(^|\/)(tests?|__tests__|spec)\/|(^|\/)test_[^/]+\.py$|_test\.(py|go)$|\.(test|spec)\.[cm]?[jt]sx?$/i;
/** Vendored folders: what is in there is not the repo's own work. */
export const SKIPPED_PATH = /(^|\/)(node_modules|vendor|\.venv|venv|site-packages)\//;

const DEPENDENCY_FILES = new Set([
  "requirements.txt",
  "pyproject.toml",
  "poetry.lock",
  "uv.lock",
  "Pipfile.lock",
  "package.json",
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "go.mod",
  "Cargo.toml",
]);
const WORKFLOW_PATH = /^\.github\/workflows\/[^/]+\.ya?ml$/;

const basename = (path: string): string => path.slice(path.lastIndexOf("/") + 1);
const own = (files: TreeFile[]): TreeFile[] => files.filter((f) => !SKIPPED_PATH.test(f.path));
const hasPath = (files: TreeFile[], paths: string[]): boolean => files.some((f) => paths.includes(f.path));
/** The places GitHub itself reads SECURITY.md and CODEOWNERS from. */
const inRootGithubOrDocs = (name: string): string[] => [name, `.github/${name}`, `docs/${name}`];

export const STANDARDS: readonly Standard[] = [
  {
    id: "readme",
    label: "README.md",
    file: `README.md in the root, at least ${README_MIN_BYTES} bytes`,
    why: "Says what the agent does, what goes in and out, and how to run it.",
    check: (files) => files.some((f) => f.path.toLowerCase() === "readme.md" && f.size >= README_MIN_BYTES),
  },
  {
    id: "agent-yaml",
    label: "agent.yaml",
    file: "agent.yaml or agent.yml in the root",
    why: "The manifest and mandate that put the agent on the Living Map.",
    check: (files) => hasPath(files, ["agent.yaml", "agent.yml"]),
  },
  {
    id: "audit-criteria",
    label: "AUDIT-CRITERIA.md",
    file: "AUDIT-CRITERIA.md in the root",
    why: "Testable pass or fail criteria, with the date of the last review.",
    check: (files) => hasPath(files, ["AUDIT-CRITERIA.md"]),
  },
  {
    id: "security",
    label: "SECURITY.md",
    file: "SECURITY.md in the root, .github/ or docs/",
    why: "The vulnerability disclosure policy: where to report a weakness, and what the finder can expect.",
    check: (files) => hasPath(files, inRootGithubOrDocs("SECURITY.md")),
  },
  {
    id: "licence",
    label: "LICENSE",
    file: "LICENSE, LICENSE.md, LICENSE.txt or COPYING in the root",
    why: "MIT, so others can reuse the agent.",
    check: (files) => hasPath(files, ["LICENSE", "LICENSE.md", "LICENSE.txt", "COPYING"]),
  },
  {
    id: "tests",
    label: "Tests",
    file: "A tests/ folder, or test files such as test_*.py or *.test.ts",
    why: "At least one test that runs.",
    check: (files) => own(files).some((f) => TEST_PATH.test(f.path)),
  },
  {
    id: "dependencies",
    label: "Dependencies",
    file: "requirements.txt, pyproject.toml, package.json, go.mod, Cargo.toml or a lockfile",
    why: "Pinned versions in a manifest or lockfile.",
    check: (files) => own(files).some((f) => DEPENDENCY_FILES.has(basename(f.path))),
  },
  {
    id: "ci",
    label: "CI",
    file: "A workflow in .github/workflows/ (.yml or .yaml)",
    why: "The checks run on every pull request.",
    check: (files) => files.some((f) => WORKFLOW_PATH.test(f.path)),
  },
  {
    id: "codeowners",
    label: "CODEOWNERS",
    file: "CODEOWNERS in the root, .github/ or docs/",
    why: "A named owner, who reviews the agent every quarter.",
    check: (files) => hasPath(files, inRootGithubOrDocs("CODEOWNERS")),
  },
];

/**
 * What a repo's file list says about each standard: found = true; not found in a cut-off list = null (cannot tell);
 * otherwise false. The same rule as `inspectTree` in src/lib/repo-signals.ts.
 */
export function evaluateStandards(files: TreeFile[], truncated: boolean): Checks {
  const checks: Checks = {};
  for (const s of STANDARDS) checks[s.id] = s.check(files) ? true : truncated ? null : false;
  return checks;
}

/** Counts over the nine standards. A standard without an answer counts as unknown, never as missing. */
export function tally(c: Checks): { met: number; missing: number; unknown: number; total: number; complete: boolean } {
  let met = 0;
  let missing = 0;
  for (const s of STANDARDS) {
    if (c[s.id] === true) met++;
    else if (c[s.id] === false) missing++;
  }
  const total = STANDARDS.length;
  return { met, missing, unknown: total - met - missing, total, complete: met === total };
}
