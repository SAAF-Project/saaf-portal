import { beforeEach, describe, expect, it } from "vitest";
import { STANDARDS, type Checks } from "../components/temple/standards/standards";
import { resetRepoStandardsMemo } from "./repo-standards";
import { hashRepoName, isRevivable } from "./revivable";
import { codeownersReader, loadRevived, ownersOf, resetRevivedMemo, revivedBy, type ReadCodeowners } from "./revived";

// Made-up repo names and logins only. The tests bring their own list of hashes; the shipped list is never matched.

beforeEach(() => {
  resetRepoStandardsMemo();
  resetRevivedMemo();
});

const QUIET = new Set(["quiet-agent", "quiet-service", "quiet-unfinished", "quiet-other"].map(hashRepoName));
const quiet = (name: string) => isRevivable(name, QUIET);

const checks = (missing: string[] = []): Checks => Object.fromEntries(STANDARDS.map((s) => [s.id, !missing.includes(s.id)]));
const repo = (name: string, missing: string[] = [], pushed_at = "2026-11-17T10:00:00Z") => ({ name, pushed_at, checks: checks(missing) });

describe("ownersOf", () => {
  it("reads plain handles, several on a line, each once and in lower case", () => {
    expect(ownersOf("* @ann\n/docs/ @bob @Carol-D\n*.py @ann\n")).toEqual(["ann", "bob", "carol-d"]);
    expect(ownersOf("*\t@ann\r\n/src/  @bob\r\n")).toEqual(["ann", "bob"]);
  });

  it("does not count comments: a line that starts with #, or the rest of a line after #", () => {
    expect(ownersOf("# @ann owns this\n  # and @bob too\n* @carol # was @dave\n")).toEqual(["carol"]);
  });

  it("leaves out team handles and e-mail addresses", () => {
    expect(ownersOf("* @sample-org/auditors @ann\n/docs/ someone@example.com\n")).toEqual(["ann"]);
    expect(ownersOf("* @sample-org/ann\n")).toEqual([]);
  });

  it("matches a whole handle only: @anna does not name ann, and @ann does not name anna", () => {
    expect(ownersOf("* @anna\n")).toEqual(["anna"]);
    expect(ownersOf("* @anna\n")).not.toContain("ann");
    expect(ownersOf("* @ann\n")).not.toContain("anna");
    expect(ownersOf("* @ann-b\n")).toEqual(["ann-b"]);
    expect(ownersOf("* x@ann @-ann @ann- @\n")).toEqual([]);
  });

  it("gives nothing for an empty file", () => {
    expect(ownersOf("")).toEqual([]);
  });
});

describe("revivedBy", () => {
  const files: Record<string, string> = {
    "quiet-agent": "* @ann\n",
    "quiet-service": "* @Ann @bob\n",
    "quiet-unfinished": "* @ann\n",
    "quiet-other": "* @anna\n",
    "busy-agent": "* @ann\n",
  };
  const reader = () => {
    const asked: string[] = [];
    const read: ReadCodeowners = async (r) => {
      asked.push(r.name);
      return files[r.name] ?? null;
    };
    return { asked, read };
  };
  const REPOS = [
    repo("busy-agent"), // complete and owned, but never quiet
    repo("quiet-agent"),
    repo("quiet-other"), // owned by someone else
    repo("quiet-service"),
    repo("quiet-unfinished", ["tests"]), // quiet and owned, 8 of 9
  ];

  it("counts a repo only when it was quiet, has all nine standards and names the member", async () => {
    const { read } = reader();
    expect(await revivedBy("ann", REPOS, read, quiet)).toEqual(["quiet-agent", "quiet-service"]);
    expect(await revivedBy("bob", REPOS, read, quiet)).toEqual(["quiet-service"]);
    expect(await revivedBy("anna", REPOS, read, quiet)).toEqual(["quiet-other"]);
    expect(await revivedBy("carol", REPOS, read, quiet)).toEqual([]);
  });

  it("matches the login whatever its case", async () => {
    expect(await revivedBy("ANN", REPOS, reader().read, quiet)).toEqual(["quiet-agent", "quiet-service"]);
  });

  it("does not count a quiet repo the member owns with 8 of 9 standards, or with a standard that is not checked", async () => {
    const { read } = reader();
    expect(await revivedBy("ann", [repo("quiet-unfinished", ["tests"])], read, quiet)).toEqual([]);
    const unknown = { ...repo("quiet-agent"), checks: { ...checks(), ci: null } };
    expect(await revivedBy("ann", [unknown], read, quiet)).toEqual([]);
  });

  it("reads CODEOWNERS only for repos that were quiet and are complete", async () => {
    const { asked, read } = reader();
    await revivedBy("ann", REPOS, read, quiet);
    expect(asked.sort()).toEqual(["quiet-agent", "quiet-other", "quiet-service"]);
  });

  it("leaves out a repo whose CODEOWNERS cannot be read, and does not throw", async () => {
    const read: ReadCodeowners = async (r) => {
      if (r.name === "quiet-agent") return null;
      if (r.name === "quiet-service") throw new Error("network down");
      return "* @ann\n";
    };
    expect(await revivedBy("ann", [repo("quiet-agent"), repo("quiet-service"), { ...repo("quiet-other") }], read, quiet)).toEqual(["quiet-other"]);
  });

  it("counts nothing without a login, and nothing on the shipped list for made-up names", async () => {
    const { asked, read } = reader();
    expect(await revivedBy("", REPOS, read, quiet)).toEqual([]);
    expect(await revivedBy("ann", REPOS, read)).toEqual([]);
    expect(asked).toEqual([]);
  });
});

/** A stand-in for GitHub's contents API. `files` holds text per "repo/path", or a status code for a failure. */
function fakeContents(files: Record<string, string | number>) {
  const calls: string[] = [];
  const inits: (RequestInit | undefined)[] = [];
  const fetchImpl = (async (url: string, init?: RequestInit) => {
    calls.push(url);
    inits.push(init);
    const m = /\/repos\/SAAF-Project\/([^/]+)\/contents\/(.+)$/.exec(url);
    const hit = m ? files[`${decodeURIComponent(m[1])}/${m[2]}`] : undefined;
    const answer = (status: number, body = "") => ({ ok: status === 200, status, text: async () => body }) as Response;
    if (hit === undefined) return answer(404);
    if (hit === -1) throw new Error("network down");
    return typeof hit === "number" ? answer(hit) : answer(200, hit);
  }) as unknown as typeof fetch;
  return { fetchImpl, calls, inits, files };
}

describe("codeownersReader", () => {
  const at = (name: string, pushed_at = "2026-11-17T10:00:00Z") => ({ name, pushed_at });

  it("tries the root, then .github/, then docs/, and stops at the first that exists", async () => {
    const gh = fakeContents({ "in-root/CODEOWNERS": "* @ann\n", "in-root/.github/CODEOWNERS": "* @bob\n", "in-github/.github/CODEOWNERS": "* @bob\n", "in-docs/docs/CODEOWNERS": "* @carol\n" });
    const read = codeownersReader(gh.fetchImpl, "t");
    expect(await read(at("in-root"))).toBe("* @ann\n");
    expect(gh.calls).toEqual(["https://api.github.com/repos/SAAF-Project/in-root/contents/CODEOWNERS"]);
    expect(await read(at("in-github"))).toBe("* @bob\n");
    expect(await read(at("in-docs"))).toBe("* @carol\n");
    expect(gh.calls.slice(-3).map((c) => c.split("/contents/")[1])).toEqual(["CODEOWNERS", ".github/CODEOWNERS", "docs/CODEOWNERS"]);
  });

  it("asks with the server token, for the raw text, past the fetch cache", async () => {
    const gh = fakeContents({ "in-root/CODEOWNERS": "* @ann\n" });
    await codeownersReader(gh.fetchImpl, "the-token")(at("in-root"));
    expect(gh.inits[0]?.cache).toBe("no-store");
    expect(gh.inits[0]?.headers).toEqual({ Authorization: "Bearer the-token", Accept: "application/vnd.github.raw+json" });
  });

  it("keeps a repo's text until its pushed_at changes", async () => {
    const gh = fakeContents({ "in-root/CODEOWNERS": "* @ann\n" });
    const read = codeownersReader(gh.fetchImpl, "t");
    await read(at("in-root"));
    await read(at("in-root"));
    await codeownersReader(gh.fetchImpl, "t")(at("in-root")); // another dashboard load
    expect(gh.calls).toHaveLength(1);
    gh.files["in-root/CODEOWNERS"] = "* @bob\n";
    expect(await read(at("in-root"))).toBe("* @ann\n");
    expect(await read(at("in-root", "2026-11-17T11:00:00Z"))).toBe("* @bob\n");
    expect(gh.calls).toHaveLength(2);
  });

  it("shares one read between two loads at the same moment", async () => {
    const gh = fakeContents({ "in-root/CODEOWNERS": "* @ann\n" });
    const read = codeownersReader(gh.fetchImpl, "t");
    expect(await Promise.all([read(at("in-root")), read(at("in-root"))])).toEqual(["* @ann\n", "* @ann\n"]);
    expect(gh.calls).toHaveLength(1);
  });

  it("gives null for a failure and asks again the next time", async () => {
    for (const failure of [500, 403, -1]) {
      resetRevivedMemo();
      const gh = fakeContents({ "in-root/CODEOWNERS": failure, "in-root/.github/CODEOWNERS": "* @bob\n" });
      const read = codeownersReader(gh.fetchImpl, "t");
      expect(await read(at("in-root"))).toBeNull(); // a failure is not "not there": the next place is not tried
      expect(gh.calls).toHaveLength(1);
      gh.files["in-root/CODEOWNERS"] = "* @ann\n";
      expect(await read(at("in-root"))).toBe("* @ann\n");
      expect(gh.calls).toHaveLength(2);
    }
  });

  it("gives null when the file is in none of the three places, and asks again the next time", async () => {
    const gh = fakeContents({});
    const read = codeownersReader(gh.fetchImpl, "t");
    expect(await read(at("nowhere"))).toBeNull();
    expect(await read(at("nowhere"))).toBeNull();
    expect(gh.calls).toHaveLength(6);
  });
});

describe("loadRevived", () => {
  const blob = (path: string, size = 100) => ({ path, type: "blob", size });
  const COMPLETE = ["agent.yaml", "AUDIT-CRITERIA.md", "SECURITY.md", "LICENSE", "tests/test_agent.py", "requirements.txt", ".github/workflows/ci.yml", ".github/CODEOWNERS"];
  const tree = (paths: string[]) => ({ tree: [blob("README.md", 2000), ...paths.map((p) => blob(p))] });

  /** GitHub with the repo list, the file lists and the CODEOWNERS files of made-up repos. */
  function fakeGitHub() {
    const state = {
      failList: false,
      pushed: { "quiet-agent": "2026-11-17T10:00:00Z" } as Record<string, string>,
      trees: { "quiet-agent": tree(COMPLETE), "quiet-unfinished": tree(COMPLETE.filter((p) => !p.startsWith("tests/"))), "busy-agent": tree(COMPLETE) } as Record<string, unknown>,
      owners: { "quiet-agent": "* @ann\n", "quiet-unfinished": "* @ann\n", "busy-agent": "* @ann\n" } as Record<string, string | number>,
    };
    const calls: string[] = [];
    const fetchImpl = (async (url: string) => {
      calls.push(url);
      const json = (status: number, body: unknown = null) => ({ ok: status === 200, status, json: async () => body, text: async () => String(body) }) as Response;
      if (url.includes("/orgs/SAAF-Project/repos")) {
        if (state.failList) return json(500);
        return json(200, Object.keys(state.trees).map((name) => ({ name, private: true, archived: false, pushed_at: state.pushed[name] ?? "2026-11-01T00:00:00Z" })));
      }
      const t = /\/repos\/SAAF-Project\/([^/]+)\/git\/trees\//.exec(url)?.[1];
      if (t) return state.trees[t] ? json(200, state.trees[t]) : json(404);
      const c = /\/repos\/SAAF-Project\/([^/]+)\/contents\/(.+)$/.exec(url);
      if (c && c[2] === ".github/CODEOWNERS") {
        const hit = state.owners[c[1]];
        return typeof hit === "string" ? json(200, hit) : json(hit ?? 404);
      }
      return json(404);
    }) as unknown as typeof fetch;
    // CODEOWNERS reads; the board's one look at the foundation's security policy is not one of them
    const contentCalls = () => calls.filter((c) => c.includes("/contents/") && !c.includes("/.github/contents/"));
    return { fetchImpl, calls, state, contentCalls };
  }
  const MINUTE = 60_000;

  it("finds the member's revived repos from the board's data, reading CODEOWNERS only where it matters", async () => {
    const gh = fakeGitHub();
    expect(await loadRevived("Ann", gh.fetchImpl, "t", () => 0, quiet)).toEqual(["quiet-agent"]);
    // root (404) and .github/ for the one repo that was quiet and is complete; nothing for the other two
    expect(gh.contentCalls().map((c) => c.split("/repos/SAAF-Project/")[1])).toEqual(["quiet-agent/contents/CODEOWNERS", "quiet-agent/contents/.github/CODEOWNERS"]);
    expect(await loadRevived("bob", gh.fetchImpl, "t", () => 0, quiet)).toEqual([]);
  });

  it("costs no GitHub call on the next loads, and one read again after a push", async () => {
    const gh = fakeGitHub();
    await loadRevived("ann", gh.fetchImpl, "t", () => 0, quiet);
    const before = gh.calls.length;
    await loadRevived("ann", gh.fetchImpl, "t", () => 30_000, quiet);
    await loadRevived("bob", gh.fetchImpl, "t", () => 40_000, quiet);
    expect(gh.calls.length).toBe(before);

    await loadRevived("ann", gh.fetchImpl, "t", () => 2 * MINUTE, quiet); // the board refreshes: the repo list and the org's security policy, nothing else
    expect(gh.calls.length).toBe(before + 2);

    gh.state.pushed["quiet-agent"] = "2026-11-17T12:00:00Z";
    gh.state.owners["quiet-agent"] = "* @bob\n";
    expect(await loadRevived("ann", gh.fetchImpl, "t", () => 4 * MINUTE, quiet)).toEqual([]);
    expect(await loadRevived("bob", gh.fetchImpl, "t", () => 4 * MINUTE, quiet)).toEqual(["quiet-agent"]);
    expect(gh.contentCalls()).toHaveLength(4);
  });

  it("counts nothing while CODEOWNERS cannot be read, and picks it up at a later load", async () => {
    const gh = fakeGitHub();
    gh.state.owners["quiet-agent"] = 500;
    expect(await loadRevived("ann", gh.fetchImpl, "t", () => 0, quiet)).toEqual([]);
    gh.state.owners["quiet-agent"] = "* @ann\n";
    expect(await loadRevived("ann", gh.fetchImpl, "t", () => 1000, quiet)).toEqual(["quiet-agent"]);
  });

  it("gives an empty list, never an error, without a token, without a repo list or when everything fails", async () => {
    const gh = fakeGitHub();
    expect(await loadRevived("ann", gh.fetchImpl, undefined, () => 0, quiet)).toEqual([]);
    expect(gh.calls).toEqual([]);
    gh.state.failList = true;
    expect(await loadRevived("ann", gh.fetchImpl, "t", () => 0, quiet)).toEqual([]);
    resetRepoStandardsMemo();
    const broken = (async () => {
      throw new Error("network down");
    }) as unknown as typeof fetch;
    expect(await loadRevived("ann", broken, "t", () => 0, quiet)).toEqual([]);
  });
});
