import { describe, expect, it } from "vitest";
import { LEVEL_MAX, POINTS, pointsAt, scoreDay, type DayStep, type Levels, type RepoDay } from "./leaderboard";

// A simulation of the hardening day with 100 kinds of participants, run through the real scoring (leaderboard.ts).
// It checks that the day is fair (speed, padding, copying, stealing and talking to the grader do not win; care does)
// and exciting (the leader at 15:00 does not always win). Synthetic repos and people only. Set SIM_REPORT=<path> to
// write the numbers for the report.

const START = Date.parse("2026-11-17T08:00:00Z"); // 09:00 in Amsterdam
const at = (min: number) => new Date(START + Math.round(min * 60_000)).toISOString();
const END_MIN = 435; // 16:15
const HACK_MIN = 195; // 12:15, after the speakers
const FREEZE_MIN = 375; // 15:15
const W = { end: at(END_MIN) };

function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 2 ** 32;
  };
}
type Rand = ReturnType<typeof rng>;
const pick = <T,>(r: Rand, xs: T[]): T => xs[Math.floor(r() * xs.length)];
const draw = (r: Rand, dist: number[]): number => {
  let x = r();
  for (let i = 0; i < dist.length; i++) if ((x -= dist[i]) < 0) return i;
  return dist.length - 1;
};

const IDS = ["readme", "audit-criteria", "agent-yaml", "tests", "ci", "dependencies", "licence", "codeowners"];
// Start levels as found in the dress rehearsal of 15 Nov 2026 on 59 live repos.
const START_DIST: Record<string, number[]> = {
  readme: [0.15, 0.17, 0.65, 0.03],
  "audit-criteria": [0.68, 0.07, 0.08, 0.17],
  "agent-yaml": [0.9, 0.03, 0.05, 0.02],
  tests: [0.4, 0.2, 0.25, 0.15],
  ci: [0.55, 0.1, 0.25, 0.1],
  dependencies: [0.2, 0.5, 0.3],
  licence: [0.8, 0.2],
  codeowners: [0.93, 0.07],
};
// Minutes of work for a level, with AI help. Level 1 is quick; real depth takes time and knowledge of the agent.
const COST: Record<string, number[]> = {
  readme: [1, 8, 25, 50],
  "audit-criteria": [1, 10, 30, 60],
  "agent-yaml": [1, 3, 10, 25],
  tests: [1, 8, 20, 40],
  ci: [1, 3, 8, 20],
  dependencies: [1, 2, 5],
  licence: [1, 1],
  codeowners: [1, 1],
};
type Quality = "junk" | "generic" | "specific" | "excellent";
// The level each kind of work really reaches. Junk is nonsense or a trivial test: the machine layer makes it 0.
const TARGET: Record<Quality, Record<string, number>> = {
  junk: { readme: 0, "audit-criteria": 0, "agent-yaml": 1, tests: 0, ci: 1, dependencies: 1, licence: 1, codeowners: 1 },
  generic: { readme: 1, "audit-criteria": 1, "agent-yaml": 2, tests: 1, ci: 2, dependencies: 2, licence: 1, codeowners: 1 },
  specific: { readme: 2, "audit-criteria": 2, "agent-yaml": 2, tests: 2, ci: 2, dependencies: 2, licence: 1, codeowners: 1 },
  excellent: { readme: 3, "audit-criteria": 3, "agent-yaml": 3, tests: 3, ci: 3, dependencies: 2, licence: 1, codeowners: 1 },
};
const DEPTH_ORDER = ["readme", "audit-criteria", "tests", "agent-yaml", "ci", "dependencies", "licence", "codeowners"];
const BREADTH_ORDER = ["licence", "codeowners", "dependencies", "ci", "agent-yaml", "readme", "audit-criteria", "tests"];

type Special = "thief" | "injector" | "copier" | "bot" | "reverter" | "late-pr" | "late-push" | "reviver" | "organiser";
interface Persona {
  login: string;
  kind: string;
  quality: Quality;
  strategy: "depth" | "breadth";
  arrive: number;
  speed: number;
  repos: number;
  path: "own" | "pr-wait" | "push";
  team?: number;
  special?: Special;
}

/** The 100 kinds of participant: 87 regular combinations and 13 special behaviours. */
function people(): Persona[] {
  const out: Persona[] = [];
  const qualities: Quality[] = ["excellent", "specific", "generic", "junk"];
  const paces: [string, number][] = [["early", 0], ["steady", HACK_MIN], ["late", 330]];
  const speeds: [string, number][] = [["fast", 0.6], ["normal", 1], ["slow", 1.5]];
  const paths: Persona["path"][] = ["own", "pr-wait", "push"];
  // All 216 combinations of quality, strategy, pace, speed and path; 87 of them, spread evenly.
  const combos: [Quality, "depth" | "breadth", number, number, Persona["path"]][] = [];
  for (const q of qualities)
    for (const strategy of ["depth", "breadth"] as const)
      for (const [, arrive] of paces) for (const [, f] of speeds) for (const path of paths) combos.push([q, strategy, arrive, f, path]);
  for (let i = 0; i < 87; i++) {
    const [q, strategy, arrive, f, path] = combos[Math.floor((i * combos.length) / 87)];
    out.push({
      login: `p${String(i).padStart(2, "0")}`,
      kind: `${q}·${strategy}`,
      quality: q,
      strategy,
      arrive,
      speed: f,
      repos: strategy === "depth" ? 1 + (i % 2) : 6 + (i % 5),
      path,
      team: i % 6 === 0 ? Math.floor(i / 12) : undefined, // some work in teams that share a repo
    });
  }
  const special = (s: Special, q: Quality, extra: Partial<Persona> = {}): Persona => ({
    login: `s-${s}-${out.length}`,
    kind: s,
    quality: q,
    strategy: "depth",
    arrive: HACK_MIN,
    speed: 1,
    repos: 1,
    path: "own",
    special: s,
    ...extra,
  });
  out.push(special("thief", "junk"), special("thief", "junk"));
  out.push(special("injector", "excellent"), special("injector", "excellent"));
  out.push(special("copier", "generic", { repos: 6, strategy: "breadth" }), special("copier", "generic", { repos: 6, strategy: "breadth" }));
  out.push(special("bot", "generic", { login: "dependabot[bot]" }));
  out.push(special("reverter", "specific"), special("reverter", "specific"));
  out.push(special("late-pr", "excellent"), special("late-push", "excellent"));
  out.push(special("reviver", "excellent"), special("organiser", "excellent"));
  return out;
}

interface Landing {
  at: number;
  login: string;
  repo: number;
  set: Record<string, number>;
  opened?: number;
  /** For thieves and reverters: put back a snapshot instead of raising levels. */
  restore?: boolean;
}

/** One simulated day. */
function simulate(seed: number) {
  const r = rng(seed);
  const repos = Array.from({ length: 45 }, (_, i) => ({
    name: `agent-${String(i).padStart(2, "0")}`,
    start: Object.fromEntries(IDS.map((id) => [id, draw(r, START_DIST[id])])) as Levels,
    made: false,
  }));
  const team: Record<number, number> = {};
  const ps = people();
  const landings: Landing[] = [];
  const popular = (r2: number) => Math.floor(Math.pow(r2, 1.6) * repos.length); // some repos draw more people

  for (const p of ps) {
    if (p.special === "organiser") continue; // merges other people's work: credit goes to the authors
    if (p.special === "thief") {
      // does no work of its own: removes the best standard of a busy repo and puts it back later
      const repo = popular(r());
      const t = HACK_MIN + 60 + r() * 120;
      landings.push({ at: t, login: p.login, repo, set: {}, restore: true }, { at: t + 10, login: p.login, repo, set: {}, restore: true });
      continue;
    }
    let mine: number[];
    if (p.special === "reviver") {
      repos.push({ name: `quiet-${repos.length}`, start: { readme: 1 }, made: false });
      mine = [repos.length - 1];
    } else if (p.team !== undefined) {
      team[p.team] ??= popular(r());
      mine = [team[p.team]];
    } else mine = Array.from({ length: p.repos }, () => popular(r()));
    let clock = p.arrive + r() * 20;
    const rate = (t: number) => (t < HACK_MIN ? 0.4 : 1); // during the talks people work at a lower pace
    const order = p.strategy === "depth" ? DEPTH_ORDER : BREADTH_ORDER;
    const tasks: [number, string][] =
      p.strategy === "depth" ? mine.flatMap((repo) => order.map((id) => [repo, id] as [number, string])) : order.flatMap((id) => mine.map((repo) => [repo, id] as [number, string]));
    for (const [repo, id] of tasks) {
      let level = TARGET[p.quality][id];
      if (p.special === "injector" && id === "readme") level = 0; // talking to the grader zeroes the file
      if (p.special === "copier" && (id === "readme" || id === "audit-criteria")) level = 0; // a copy of another repo's file is not this agent's
      if (p.special === "bot" && id !== "dependencies") continue;
      if (repos[repo].start[id]! >= level && p.strategy === "breadth") continue; // nothing to gain here
      clock += (COST[id][level] * p.speed) / rate(clock);
      const landAt = clock + (p.path === "pr-wait" ? 5 + r() * 40 : 0);
      if (p.special === "late-pr") {
        landings.push({ at: END_MIN + 10, login: p.login, repo, set: { [id]: level }, opened: END_MIN - 5 });
        continue;
      }
      if (p.special === "late-push") {
        landings.push({ at: END_MIN + 10, login: p.login, repo, set: { [id]: level } });
        continue;
      }
      if (landAt > END_MIN) break;
      landings.push({ at: landAt, login: p.login, repo, set: { [id]: level }, opened: p.path === "pr-wait" ? clock : undefined });
    }
    if (p.special === "reverter") {
      // remove the best standard of a busy repo and put it back a little later
      const repo = popular(r());
      const t = HACK_MIN + 60 + r() * 120;
      landings.push({ at: t, login: p.login, repo, set: {}, restore: true });
      landings.push({ at: t + 10, login: p.login, repo, set: {}, restore: true });
    }
  }

  // Apply the landings in time order: a change lands only where it raises a level.
  landings.sort((a, b) => a.at - b.at);
  const now: Levels[] = repos.map((x) => ({ ...x.start }));
  const steps: DayStep[][] = repos.map(() => []);
  const removed = new Map<number, Levels>();
  const noise = rng(seed * 7 + 3);
  for (const l of landings) {
    const cur = now[l.repo];
    if (l.restore) {
      if (!removed.has(l.repo)) {
        removed.set(l.repo, { ...cur });
        const best = IDS.reduce((a, id) => (pointsAt(id, cur[id]) > pointsAt(a, cur[a]) ? id : a), IDS[0]);
        now[l.repo] = { ...cur, [best]: 0 };
      } else {
        now[l.repo] = { ...removed.get(l.repo)! };
        removed.delete(l.repo);
      }
    } else {
      for (const [id, lv] of Object.entries(l.set)) if (lv > (cur[id] ?? 0)) now[l.repo] = { ...now[l.repo], [id]: lv };
    }
    // The grader is right 97% of the time and otherwise one level off (calibration of 15 Nov 2026).
    const graded = Object.fromEntries(
      IDS.map((id) => {
        const lv = now[l.repo][id] ?? 0;
        const off = noise() < 0.03 && lv > 0 ? (noise() < 0.5 ? -1 : 1) : 0;
        return [id, Math.max(0, Math.min(LEVEL_MAX[id], lv + off))];
      }),
    );
    steps[l.repo].push({ sha: `${l.repo}-${steps[l.repo].length}`, at: at(l.at), login: l.login, opened_at: l.opened !== undefined ? at(l.opened) : null, levels: graded });
  }
  const days: RepoDay[] = repos.map((x, i) => ({ name: x.name, url: "", made_today: x.made, start: x.start, steps: steps[i] }));
  return { personas: ps, days };
}

const kindOf = (ps: Persona[]) => new Map(ps.map((p) => [p.login, p.kind]));

describe("simulation: 100 kinds of participant", () => {
  it("has exactly 100 kinds, 13 of them special", () => {
    const ps = people();
    expect(ps).toHaveLength(100);
    expect(ps.filter((p) => p.special)).toHaveLength(13);
  });

  it("is fair and exciting over 300 simulated days", () => {
    const DAYS = 300;
    const wins = new Map<string, number>();
    const bestWins = new Map<string, number>();
    const avg = new Map<string, { sum: number; n: number }>();
    let leaderHeld = 0;
    let finalLeadChanges = 0;
    let margins = 0;

    for (let d = 0; d < DAYS; d++) {
      const { personas, days } = simulate(1000 + d);
      const kinds = kindOf(personas);
      // injectors are flagged by the grader and disqualified by the organisers
      const out = new Set(personas.filter((p) => p.special === "injector").map((p) => p.login));
      const final = scoreDay(days, { ...W, until: W.end }, Infinity, out);
      const at1500 = scoreDay(days, { ...W, until: at(360) }, 5, out);

      // conservation: per repo, what rose today is exactly what was credited plus what went to nobody
      for (const rs of final.repos) expect(rs.credited + rs.uncredited).toBe(rs.rise);
      const people = final.top_contributor.reduce((n, p) => n + p.points + p.capped, 0);
      expect(people).toBe(final.repos.reduce((n, rs) => n + rs.credited, 0));
      const top = final.top_contributor[0];
      if (top) wins.set(kinds.get(top.login)!, (wins.get(kinds.get(top.login)!) ?? 0) + 1);
      const best = final.best_agent[0];
      if (best?.by[0]) bestWins.set(kinds.get(best.by[0])!, (bestWins.get(kinds.get(best.by[0])!) ?? 0) + 1);
      if (top && at1500.top_contributor[0]?.login === top.login) leaderHeld++;
      if (final.top_contributor[1]) margins += final.top_contributor[0].points - final.top_contributor[1].points;

      // lead changes in the last two hours, in steps of 15 minutes
      let prev: string | undefined;
      for (let m = 315; m <= END_MIN; m += 15) {
        const lead = scoreDay(days, { ...W, until: at(m) }, 5, out).top_contributor[0]?.login;
        if (prev && lead && lead !== prev) finalLeadChanges++;
        prev = lead ?? prev;
      }
      for (const p of personas) {
        const row = final.top_contributor.find((x) => x.login === p.login);
        const a = avg.get(p.kind) ?? { sum: 0, n: 0 };
        a.sum += row?.points ?? 0;
        a.n++;
        avg.set(p.kind, a);
      }
    }

    const share = (k: (kind: string) => boolean, m = wins) => [...m.entries()].filter(([kind]) => k(kind)).reduce((n, [, c]) => n + c, 0) / DAYS;
    const careful = share((k) => k.startsWith("excellent") || k.startsWith("specific"));
    const generic = share((k) => k.startsWith("generic"));
    const cheats = share((k) => ["junk·depth", "junk·breadth", "thief", "injector", "copier", "bot", "organiser", "late-push"].includes(k));
    const held = leaderHeld / DAYS;
    const report = {
      days: DAYS,
      top_contributor_wins: Object.fromEntries([...wins.entries()].sort((a, b) => b[1] - a[1])),
      best_agent_wins: Object.fromEntries([...bestWins.entries()].sort((a, b) => b[1] - a[1])),
      average_points: Object.fromEntries([...avg.entries()].map(([k, v]) => [k, Math.round((v.sum / v.n) * 10) / 10]).sort((a, b) => (b[1] as number) - (a[1] as number))),
      careful_share: careful,
      generic_share: generic,
      cheat_share: cheats,
      leader_at_1500_wins: held,
      lead_changes_last_two_hours_per_day: finalLeadChanges / DAYS,
      average_margin_points: margins / DAYS,
      points: POINTS,
    };
    if (process.env.SIM_REPORT) require("node:fs").writeFileSync(process.env.SIM_REPORT, JSON.stringify(report, null, 1));

    // fair: care wins, speed and tricks do not
    expect(careful).toBeGreaterThanOrEqual(0.8);
    expect(generic).toBeLessThanOrEqual(0.15);
    expect(cheats).toBe(0);
    for (const k of ["injector", "bot", "organiser", "late-push"]) expect(report.average_points[k] ?? 0).toBe(0);
    // a thief gains nothing from stealing; at most a stray point when the grader is one level off (3% of the time)
    expect(report.average_points["thief"] ?? 0).toBeLessThanOrEqual(0.5);
    // depth and breadth of real work both have a fair chance
    expect(share((k) => k === "excellent·depth")).toBeGreaterThan(0.2);
    expect(share((k) => k === "specific·breadth" || k === "excellent·breadth")).toBeGreaterThan(0.2);
    expect(report.average_points["excellent·depth"]).toBeGreaterThan(report.average_points["generic·breadth"]);
    expect(report.average_points["junk·breadth"]).toBeLessThan(report.average_points["specific·depth"]);
    // exciting: the leader at 15:00 does not always win, but the result is not a lottery either
    expect(held).toBeGreaterThan(0.3);
    expect(held).toBeLessThan(0.85);
    void FREEZE_MIN;
  }, 120_000);
});
