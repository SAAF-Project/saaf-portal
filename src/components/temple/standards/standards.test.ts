import { describe, expect, it } from "vitest";
import { README_MIN_BYTES, STANDARDS, evaluateStandards, tally, type TreeFile } from "./standards";

const file = (path: string, size = 100): TreeFile => ({ path, size });
const files = (...paths: string[]): TreeFile[] => paths.map((p) => file(p));
const check = (id: string, list: TreeFile[]): boolean => STANDARDS.find((s) => s.id === id)!.check(list);

/** A repo with all nine in place. */
const COMPLETE: TreeFile[] = [
  file("README.md", 2000),
  ...files("agent.yaml", "AUDIT-CRITERIA.md", "SECURITY.md", "LICENSE", "tests/test_agent.py", "requirements.txt", ".github/workflows/ci.yml", ".github/CODEOWNERS"),
];

describe("the nine standards", () => {
  it("is a list of nine, each with its own id and its texts", () => {
    expect(STANDARDS.map((s) => s.id)).toEqual(["readme", "agent-yaml", "audit-criteria", "security", "licence", "tests", "dependencies", "ci", "codeowners"]);
    expect(new Set(STANDARDS.map((s) => s.id)).size).toBe(STANDARDS.length);
    for (const s of STANDARDS) {
      expect(s.label, s.id).not.toBe("");
      expect(s.file, s.id).not.toBe("");
      expect(s.why, s.id).toMatch(/\.$/);
    }
  });

  it("wants a README.md in the root that is more than a placeholder", () => {
    expect(check("readme", [file("README.md", README_MIN_BYTES)])).toBe(true);
    expect(check("readme", [file("README.md", README_MIN_BYTES - 1)])).toBe(false);
    expect(README_MIN_BYTES).toBe(500);
    expect(check("readme", [file("readme.md", 900)])).toBe(true);
    expect(check("readme", [file("docs/README.md", 900)])).toBe(false);
    expect(check("readme", [file("README.rst", 900)])).toBe(false);
    expect(check("readme", [])).toBe(false);
  });

  it("wants agent.yaml or agent.yml in the root", () => {
    expect(check("agent-yaml", files("agent.yaml"))).toBe(true);
    expect(check("agent-yaml", files("agent.yml"))).toBe(true);
    expect(check("agent-yaml", files("config/agent.yaml", "agent.yaml.example", "my-agent.yaml"))).toBe(false);
  });

  it("wants AUDIT-CRITERIA.md in the root", () => {
    expect(check("audit-criteria", files("AUDIT-CRITERIA.md"))).toBe(true);
    expect(check("audit-criteria", files("docs/AUDIT-CRITERIA.md", "AUDIT-CRITERIA.txt"))).toBe(false);
  });

  it("finds SECURITY.md and CODEOWNERS in the root, .github/ or docs/, and nowhere else", () => {
    for (const [id, name] of [["security", "SECURITY.md"], ["codeowners", "CODEOWNERS"]]) {
      for (const path of [name, `.github/${name}`, `docs/${name}`]) expect(check(id, files(path)), path).toBe(true);
      expect(check(id, files(`src/${name}`, `docs/sub/${name}`, `${name}.bak`)), name).toBe(false);
    }
  });

  it("finds a licence file in the root", () => {
    for (const path of ["LICENSE", "LICENSE.md", "LICENSE.txt", "COPYING"]) expect(check("licence", files(path)), path).toBe(true);
    expect(check("licence", files("docs/LICENSE", "LICENSE-notes.md", "license"))).toBe(false);
  });

  it("recognises tests in common layouts, and ignores vendored ones", () => {
    for (const path of ["tests/run.py", "src/__tests__/a.ts", "test_agent.py", "pkg/x_test.go", "src/a.test.tsx", "spec/a.rb"]) {
      expect(check("tests", files(path)), path).toBe(true);
    }
    expect(check("tests", files("agent.py", "README.md"))).toBe(false);
    expect(check("tests", files("node_modules/x/tests/a.js", ".venv/lib/site-packages/t/test_a.py", "vendor/lib/a_test.go"))).toBe(false);
  });

  it("finds a manifest or lockfile, and ignores vendored ones", () => {
    for (const path of ["requirements.txt", "pyproject.toml", "poetry.lock", "uv.lock", "Pipfile.lock", "package.json", "package-lock.json", "pnpm-lock.yaml", "yarn.lock", "go.mod", "Cargo.toml", "app/package.json"]) {
      expect(check("dependencies", files(path)), path).toBe(true);
    }
    expect(check("dependencies", files("agent.py", "requirements.md", "setup.cfg"))).toBe(false);
    expect(check("dependencies", files("node_modules/x/package.json", "vendor/x/go.mod", ".venv/lib/x/pyproject.toml"))).toBe(false);
  });

  it("finds a workflow file directly in .github/workflows/", () => {
    expect(check("ci", files(".github/workflows/ci.yml"))).toBe(true);
    expect(check("ci", files(".github/workflows/checks.yaml"))).toBe(true);
    expect(check("ci", files(".github/workflows/README.md", ".github/dependabot.yml", "workflows/ci.yml", "docs/.github/workflows/ci.yml"))).toBe(false);
  });
});

describe("evaluateStandards", () => {
  it("answers true or false for every standard when the file list is whole", () => {
    expect(evaluateStandards(COMPLETE, false)).toEqual(Object.fromEntries(STANDARDS.map((s) => [s.id, true])));
    expect(evaluateStandards([], false)).toEqual(Object.fromEntries(STANDARDS.map((s) => [s.id, false])));
  });

  it("never says missing from a cut-off list: found stays found, the rest is not checked", () => {
    const none = evaluateStandards([], true);
    expect(Object.values(none).every((v) => v === null)).toBe(true);
    const some = evaluateStandards([file("README.md", 2000), file("LICENSE")], true);
    expect(some.readme).toBe(true);
    expect(some.licence).toBe(true);
    expect(Object.values(some)).not.toContain(false);
    expect(some.tests).toBeNull();
  });
});

describe("tally", () => {
  it("counts met, missing and not checked, and knows when a repo is complete", () => {
    expect(tally(evaluateStandards(COMPLETE, false))).toEqual({ met: 9, missing: 0, unknown: 0, total: 9, complete: true });
    expect(tally(evaluateStandards([file("README.md", 2000), file("LICENSE")], false))).toEqual({ met: 2, missing: 7, unknown: 0, total: 9, complete: false });
    expect(tally(evaluateStandards([file("README.md", 2000)], true))).toEqual({ met: 1, missing: 0, unknown: 8, total: 9, complete: false });
  });

  it("counts a standard without an answer as not checked, not as missing", () => {
    expect(tally({})).toEqual({ met: 0, missing: 0, unknown: 9, total: 9, complete: false });
  });
});
