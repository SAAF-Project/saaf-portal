import { beforeEach, describe, expect, it } from "vitest";
import { STANDARDS } from "../components/temple/standards/standards";
import type { RepoStandards, StandardsPayload } from "./repo-standards";
import { HARDENING_DAY, loadPrizes, resetPrizesMemo, type PrizesPayload } from "./standards-prizes";

// Every way the day can go, simulated against a stand-in for GitHub. Synthetic repos and people only.
// Times are UTC: the day runs 08:00:00-15:15:00 UTC, which is 09:00-16:15 in Amsterdam.

beforeEach(resetPrizesMemo);

const at = (hms: string) => `2026-11-17T${hms.length === 5 ? `${hms}:00` : hms}Z`;
const now = (hms: string) => () => Date.parse(at(hms));
const IDS = STANDARDS.map((s) => s.id);
const FILE: Record<string, { path: string; size: number }> = {
  readme: { path: "README.md", size: 2000 },
  "agent-yaml": { path: "agent.yaml", size: 10 },
  "audit-criteria": { path: "AUDIT-CRITERIA.md", size: 10 },
  security: { path: "SECURITY.md", size: 10 },
  licence: { path: "LICENSE", size: 10 },
  tests: { path: "tests/test_agent.py", size: 10 },
  dependencies: { path: "requirements.txt", size: 10 },
  ci: { path: ".github/workflows/ci.yml", size: 10 },
  codeowners: { path: ".github/CODEOWNERS", size: 10 },
};
/** The standards in place: a number means the first n, in the order of STANDARDS. */
type Has = number | string[];
const ids = (has: Has): string[] => (typeof has === "number" ? IDS.slice(0, has) : has);
const checks = (has: Has) => Object.fromEntries(IDS.map((id) => [id, ids(has).includes(id)]));
const tree = (has: Has) => ({ tree: ids(has).map((id) => ({ ...FILE[id], type: "blob" })), truncated: false });

/** One change to the default branch: when GitHub made it, who, how, and what is in place after it. */
interface Event {
  at: string;
  by: string;
  /** A pull request merged on GitHub (default), or a direct push. */
  via?: "pr" | "push";
  /** Who pressed merge on a pull request. */
  merger?: string;
  has: Has;
}

interface FakeRepo {
  name: string;
  start: Has;
  events?: Event[];
  /** When the repo was made; before the day unless said otherwise. */
  created?: string;
  /** Overrides for the activity answer: an HTTP status. */
  activity?: number;
  /** For the fallback without activity: commits, newest first. */
  commits?: unknown[];
}

function simulate(repos: FakeRepo[]) {
  const activity: Record<string, unknown> = {};
  const trees: Record<string, unknown> = {};
  const pulls: Record<string, unknown[]> = {};
  const commits: Record<string, unknown[]> = {};
  const board: RepoStandards[] = [];
  for (const r of repos) {
    const events = r.events ?? [];
    const start = `${r.name}-start`;
    trees[start] = tree(r.start);
    // GitHub also lists pushes from before the day; they must not count
    const list: unknown[] = [{ before: `${r.name}-older`, after: start, ref: "refs/heads/main", timestamp: "2026-11-16T12:00:00Z", activity_type: "push", actor: { login: "yesterday" } }];
    pulls[r.name] = [];
    let prev = start;
    events.forEach((e, i) => {
      const sha = `${r.name}-${i}`;
      trees[sha] = tree(e.has);
      const pr = (e.via ?? "pr") === "pr";
      list.push({ before: prev, after: sha, ref: "refs/heads/main", timestamp: at(e.at), activity_type: pr ? "pr_merge" : "push", actor: { login: pr ? (e.merger ?? "organiser") : e.by } });
      if (pr) pulls[r.name].push({ merged_at: at(e.at), merge_commit_sha: sha, user: { login: e.by } });
      prev = sha;
    });
    activity[r.name] = r.activity ?? list.reverse(); // newest first, as GitHub lists them
    if (r.commits) commits[r.name] = r.commits;
    const last = events.length > 0 ? events[events.length - 1] : null;
    board.push({
      name: r.name,
      url: `https://github.com/SAAF-Project/${r.name}`,
      private: false,
      pushed_at: last ? at(last.at) : "2026-11-16T12:00:00Z",
      created_at: r.created ?? "2026-10-01T00:00:00Z",
      default_branch: "main",
      checks: checks(last ? last.has : r.start),
    });
  }

  const calls: string[] = [];
  const fetchImpl = (async (url: string) => {
    calls.push(url);
    const answer = (status: number, body: unknown = null) => ({ ok: status === 200, status, json: async () => body }) as Response;
    const m = /\/repos\/SAAF-Project\/([^/]+)\/(.*)$/.exec(url);
    if (!m) return answer(404);
    const [, name, rest] = m;
    if (rest.startsWith("activity?")) {
      const a = activity[name];
      return typeof a === "number" ? answer(a) : answer(200, (a as unknown[]).slice(0, 100)); // one page, as GitHub gives it
    }
    if (rest.startsWith("git/trees/")) {
      const sha = rest.slice("git/trees/".length).split("?")[0];
      return sha in trees ? answer(200, trees[sha]) : answer(404);
    }
    if (rest.startsWith("pulls?")) return answer(200, pulls[name] ?? []);
    if (rest.startsWith("commits?")) return commits[name] ? answer(200, commits[name]) : answer(404);
    return answer(404);
  }) as unknown as typeof fetch;

  const payload: StandardsPayload = { checked_at: at("10:00"), stale: false, ttl_seconds: 60, repos: board, archived: 0 };
  return { board: payload, fetchImpl, calls, run: (time: string) => loadPrizes(payload, fetchImpl, "t", now(time)) };
}

const people = (p: PrizesPayload) => p.people.map((x) => [x.login, x.added]);

describe("the day's leaderboard: phases and counting", () => {
  it("before the day: says nothing yet and reads nothing from GitHub", async () => {
    const s = simulate([{ name: "example-agent", start: 5 }]);
    const p = await s.run("07:30");
    expect(p.phase).toBe("before");
    expect(p.first_nine).toEqual([]);
    expect(p.standards).toBeNull();
    expect(s.calls).toEqual([]);
  });

  it("counts the first prize, the biggest jump, the people and the glow from the history of the day", async () => {
    const s = simulate([
      { name: "sample-service", start: 3, events: [{ at: "09:00", by: "bob", has: 7 }, { at: "10:00", by: "alice", has: 9 }] },
      { name: "example-agent", start: 5 },
      { name: "fresh-agent", start: 0, created: at("08:30"), events: [{ at: "08:31", by: "carol", has: 9 }] },
    ]);
    const p = await s.run("12:00");
    expect(p.phase).toBe("during");
    expect(p.first_nine.map((r) => [r.name, r.reached_at, r.before, r.after, r.by])).toEqual([["sample-service", at("10:00"), 3, 9, ["bob", "alice"]]]);
    expect(p.first_nine[0].had).toEqual(IDS.slice(0, 3));
    expect(p.first_nine[0].added).toEqual(IDS.slice(3));
    expect(people(p)).toEqual([["bob", 4], ["alice", 2]]);
    expect(p.people_total).toBe(2);
    expect(p.finished).toBe(1);
    expect(p.standards).toEqual({ start: 8, now: 14 });
    expect(p.new_repos).toEqual([{ name: "fresh-agent", url: "https://github.com/SAAF-Project/fresh-agent", met: 9 }]);
    // the new repo glows in full, the existing one glows where it gained
    expect(p.fresh).toEqual({ "sample-service": IDS.slice(3), "fresh-agent": IDS });
    // a repo nobody pushed to since the start costs no call at all
    expect(s.calls.some((c) => c.includes("/example-agent/"))).toBe(false);
  });

  it("after the day: counts the branch as it was at 16:15; a push at 16:14:59 counts, one at 16:15:01 does not", async () => {
    const s = simulate([
      { name: "example-agent", start: 2, events: [{ at: "15:14:59", by: "alice", has: 6 }, { at: "15:15:01", by: "bob", has: 9 }] },
    ]);
    const p = await s.run("17:00");
    expect(p.phase).toBe("after");
    expect(p.biggest_jump.map((r) => [r.name, r.before, r.after])).toEqual([["example-agent", 2, 6]]);
    expect(p.first_nine).toEqual([]);
    expect(people(p)).toEqual([["alice", 4]]);
    // the board glows for what is there now, including what came in after the close
    expect(p.fresh["example-agent"]).toEqual(IDS.slice(2));
  });

  it("a push at 08:59:59 belongs to the start, not to the day", async () => {
    const s = simulate([{ name: "example-agent", start: 2, events: [{ at: "07:59:59", by: "alice", has: 5 }, { at: "09:00", by: "bob", has: 6 }] }]);
    const p = await s.run("12:00");
    expect(p.biggest_jump.map((r) => [r.before, r.after])).toEqual([[5, 6]]);
    expect(people(p)).toEqual([["bob", 1]]);
  });
});

describe("the day's leaderboard: who gets the credit", () => {
  it("two people fix the same standard: the first to land counts, the second adds nothing", async () => {
    const s = simulate([
      { name: "example-agent", start: ["readme"], events: [{ at: "09:00", by: "alice", has: ["readme", "security"] }, { at: "09:05", by: "bob", has: ["readme", "security"] }] },
    ]);
    const p = await s.run("12:00");
    expect(people(p)).toEqual([["alice", 1]]);
  });

  it("a merged pull request counts for its author, not for whoever pressed merge", async () => {
    const s = simulate([{ name: "example-agent", start: 1, events: [{ at: "09:00", by: "alice", merger: "an-organiser", has: 3 }] }]);
    const p = await s.run("12:00");
    expect(people(p)).toEqual([["alice", 2]]);
  });

  it("a direct push counts for whoever pushed", async () => {
    const s = simulate([{ name: "example-agent", start: 1, events: [{ at: "09:00", by: "carol", via: "push", has: 2 }] }]);
    expect(people(await s.run("12:00"))).toEqual([["carol", 1]]);
  });

  it("bots get no credit, but what they add still counts for the repo", async () => {
    const s = simulate([{ name: "example-agent", start: 1, events: [{ at: "09:00", by: "dependabot[bot]", has: 2 }] }]);
    const p = await s.run("12:00");
    expect(p.people).toEqual([]);
    expect(p.biggest_jump.map((r) => r.jump)).toEqual([1]);
  });

  it("removed and put back by someone else: the standard stays with whoever added it first", async () => {
    const s = simulate([
      {
        name: "example-agent",
        start: ["readme"],
        events: [
          { at: "09:00", by: "alice", has: ["readme", "licence"] },
          { at: "09:30", by: "bob", via: "push", has: ["readme"] },
          { at: "10:00", by: "bob", has: ["readme", "licence"] },
        ],
      },
    ]);
    expect(people(await s.run("12:00"))).toEqual([["alice", 1]]);
  });

  it("added and then removed for good: no credit and no jump", async () => {
    const s = simulate([{ name: "example-agent", start: 1, events: [{ at: "09:00", by: "alice", has: 3 }, { at: "10:00", by: "bob", via: "push", has: 1 }] }]);
    const p = await s.run("12:00");
    expect(p.people).toEqual([]);
    expect(p.biggest_jump).toEqual([]);
  });

  it("one pull request with four standards: four for its author", async () => {
    const s = simulate([{ name: "example-agent", start: 2, events: [{ at: "09:00", by: "alice", has: 6 }] }]);
    expect(people(await s.run("12:00"))).toEqual([["alice", 4]]);
  });

  it("work on several repos adds up; with equal counts, whoever got there first ranks higher", async () => {
    const s = simulate([
      { name: "example-agent", start: 1, events: [{ at: "09:00", by: "alice", has: 2 }, { at: "09:10", by: "bob", has: 4 }] },
      { name: "sample-service", start: 1, events: [{ at: "09:20", by: "alice", has: 2 }] },
    ]);
    const p = await s.run("12:00");
    expect(people(p)).toEqual([["bob", 2], ["alice", 2]]);
    expect(p.people.find((x) => x.login === "alice")?.repos).toEqual(["example-agent", "sample-service"]);
  });
});

describe("the day's leaderboard: the prizes", () => {
  it("first prize: decided by GitHub's time to the second; the same second goes in name order", async () => {
    const s = simulate([
      { name: "sample-service", start: 8, events: [{ at: "09:00:05", by: "alice", has: 9 }] },
      { name: "example-agent", start: 8, events: [{ at: "09:00:03", by: "bob", has: 9 }] },
      { name: "fresh-agent", start: 8, events: [{ at: "09:00:03", by: "carol", has: 9 }] },
    ]);
    const p = await s.run("12:00");
    expect(p.first_nine.map((r) => [r.name, r.reached_at])).toEqual([
      ["example-agent", at("09:00:03")],
      ["fresh-agent", at("09:00:03")],
      ["sample-service", at("09:00:05")],
    ]);
  });

  it("a repo that already had all nine at the start cannot win the first prize", async () => {
    const s = simulate([{ name: "example-agent", start: 9, events: [{ at: "09:00", by: "alice", has: 9 }] }]);
    const p = await s.run("12:00");
    expect(p.first_nine).toEqual([]);
    expect(p.biggest_jump).toEqual([]);
  });

  it("all nine, then one lost: no first prize while it lacks one; back to nine, it keeps its first time", async () => {
    const events: Event[] = [{ at: "09:00", by: "alice", has: 9 }, { at: "10:00", by: "bob", via: "push", has: 8 }];
    const lost = await simulate([{ name: "example-agent", start: 7, events }]).run("12:00");
    expect(lost.first_nine).toEqual([]);
    expect(lost.closest.map((r) => [r.name, r.after])).toEqual([["example-agent", 8]]);
    resetPrizesMemo();
    const back = await simulate([{ name: "example-agent", start: 7, events: [...events, { at: "11:00", by: "bob", has: 9 }] }]).run("12:00");
    expect(back.first_nine.map((r) => r.reached_at)).toEqual([at("09:00")]);
  });

  it("biggest jump: a tie goes to the repo that reached its final count first", async () => {
    const s = simulate([
      { name: "example-agent", start: 1, events: [{ at: "10:00", by: "alice", has: 4 }] },
      { name: "sample-service", start: 1, events: [{ at: "09:30", by: "bob", has: 4 }] },
    ]);
    const p = await s.run("12:00");
    expect(p.biggest_jump.map((r) => [r.name, r.settled_at])).toEqual([
      ["sample-service", at("09:30")],
      ["example-agent", at("10:00")],
    ]);
  });

  it("a repo made during the day is listed for the organisers and counts for nobody", async () => {
    const s = simulate([{ name: "fresh-agent", start: 0, created: at("09:00"), events: [{ at: "09:01", by: "alice", has: 9 }] }]);
    const p = await s.run("12:00");
    expect(p.first_nine).toEqual([]);
    expect(p.people).toEqual([]);
    expect(p.new_repos.map((r) => r.name)).toEqual(["fresh-agent"]);
  });
});

describe("the day's leaderboard: when GitHub does not answer", () => {
  it("without repository activity: uses the first-parent commit history and the authors of merged pull requests", async () => {
    const commit = (sha: string, date: string, parents: string[], author: string | null) => ({
      sha,
      parents: parents.map((p) => ({ sha: p })),
      author: author ? { login: author } : null,
      commit: { tree: { sha: `t-${sha}` }, committer: { date } },
    });
    const s = simulate([
      {
        name: "example-agent",
        start: 2,
        activity: 404,
        events: [{ at: "10:00", by: "alice", has: 5 }],
        commits: [commit("m1", at("10:00"), ["c0", "f1"], "an-organiser"), commit("f1", at("09:30"), ["c0"], "alice"), commit("c0", at("07:00"), [], "someone")],
      },
    ]);
    // the merged branch commit f1 never stood on main on its own; m1 was merged from a pull request by alice
    const trees = { "t-c0": tree(2), "t-m1": tree(5), "t-f1": tree(9) };
    const base = s.fetchImpl;
    const fetchImpl = (async (url: string, init?: RequestInit) => {
      const m = /git\/trees\/(t-[^?]+)/.exec(url);
      if (m) return { ok: true, status: 200, json: async () => trees[m[1] as keyof typeof trees] } as Response;
      if (url.includes("/pulls?")) return { ok: true, status: 200, json: async () => [{ merged_at: at("10:00"), merge_commit_sha: "m1", user: { login: "alice" } }] } as Response;
      return base(url, init);
    }) as unknown as typeof fetch;
    const p = await loadPrizes(s.board, fetchImpl, "t", now("12:00"));
    expect(p.biggest_jump.map((r) => [r.before, r.after])).toEqual([[2, 5]]);
    expect(people(p)).toEqual([["alice", 3]]);
  });

  it("a repo whose history cannot be read is left out and counted, never zeroed", async () => {
    const s = simulate([
      { name: "broken-agent", start: 3, activity: 500, events: [{ at: "09:00", by: "alice", has: 6 }] },
      { name: "example-agent", start: 1, events: [{ at: "09:00", by: "bob", has: 2 }] },
    ]);
    const p = await s.run("12:00");
    expect(p.unread).toBe(1);
    expect(p.biggest_jump.map((r) => r.name)).toEqual(["example-agent"]);
  });

  it("a full page of activity that does not reach back to the start is not trusted", async () => {
    const many: Event[] = Array.from({ length: 100 }, (_, i) => ({ at: `09:${String(Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`, by: "alice", via: "push" as const, has: 1 + (i % 2) }));
    const s = simulate([{ name: "example-agent", start: 1, events: many }]);
    const p = await s.run("12:00");
    expect(p.unread).toBe(1);
  });

  it("works it out at most once a minute, and after a push reads only what is new", async () => {
    const s = simulate([{ name: "example-agent", start: 1, events: [{ at: "09:00", by: "alice", has: 3 }] }]);
    await s.run("12:00");
    const first = s.calls.length;
    await loadPrizes(s.board, s.fetchImpl, "t", () => Date.parse(at("12:00")) + 30_000);
    expect(s.calls.length).toBe(first);
    await s.run("12:05");
    expect(s.calls.length).toBe(first); // nothing pushed: the history is kept
  });

  it("without a token: no answer, and no call", async () => {
    const s = simulate([]);
    const p = await loadPrizes(s.board, s.fetchImpl, undefined, now("12:00"));
    expect(p.computed_at).toBeNull();
    expect(s.calls).toEqual([]);
  });

  it("covers 09:00 to 16:15 in Amsterdam", () => {
    const local = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { timeZone: "Europe/Amsterdam", hour: "2-digit", minute: "2-digit" });
    expect([local(HARDENING_DAY.start), local(HARDENING_DAY.end)]).toEqual(["09:00", "16:15"]);
  });
});
