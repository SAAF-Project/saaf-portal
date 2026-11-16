import { describe, expect, it } from "vitest";
import { snapshot, type Row, type SnapshotStore } from "./snapshot";

// A store in memory with its own clock, shared by several "server instances" (several snapshot() objects).
function memoryStore(clock: { now: number }) {
  const rows = new Map<string, { value: unknown; builtAt: number; claimedAt: number | null }>();
  const calls = { read: 0, claim: 0, write: 0 };
  const store: SnapshotStore = {
    async read<T>(key: string): Promise<Row<T> | null> {
      calls.read++;
      const r = rows.get(key);
      return r ? { value: r.value as T | null, ageMs: clock.now - r.builtAt } : null;
    },
    async claim(key, ttlMs, claimMs) {
      calls.claim++;
      const r = rows.get(key);
      if (!r) {
        rows.set(key, { value: null, builtAt: 0, claimedAt: clock.now });
        return true;
      }
      const stale = r.value === null || clock.now - r.builtAt >= ttlMs;
      const free = r.claimedAt === null || clock.now - r.claimedAt >= claimMs;
      if (stale && free) r.claimedAt = clock.now;
      return stale && free;
    },
    async write(key, value) {
      calls.write++;
      rows.set(key, { value, builtAt: clock.now, claimedAt: null });
    },
  };
  return { store, calls, rows };
}

const OPTS = { ttlMs: 60_000, memoMs: 5_000, usable: (v: { n: number; ok: boolean }) => v.ok };
const noWait = async () => undefined;

describe("snapshot", () => {
  it("builds once and serves every instance from the shared row", async () => {
    const clock = { now: 1_000_000 };
    const { store } = memoryStore(clock);
    let builds = 0;
    const build = async () => ({ n: ++builds, ok: true });
    const instances = Array.from({ length: 5 }, () => snapshot("k", OPTS, build, store, () => clock.now, noWait));

    expect(await instances[0].get()).toEqual({ n: 1, ok: true });
    for (const i of instances) expect(await i.get()).toEqual({ n: 1, ok: true });
    expect(builds).toBe(1);
  });

  it("lets one instance rebuild a stale value while the others keep serving the last one", async () => {
    const clock = { now: 1_000_000 };
    const { store } = memoryStore(clock);
    let builds = 0;
    let release: () => void = () => undefined;
    const build = async () => {
      const n = ++builds;
      if (n > 1) await new Promise<void>((r) => (release = r));
      return { n, ok: true };
    };
    const instances = Array.from({ length: 4 }, () => snapshot("k", OPTS, build, store, () => clock.now, noWait));
    await instances[0].get();

    clock.now += 61_000;
    const answers = instances.map((i) => i.get());
    await Promise.resolve();
    // Three instances answer at once with the last value; one is building.
    const settled = await Promise.race([Promise.all(answers.slice(1)), new Promise((r) => setTimeout(() => r("waiting"), 50))]);
    release();
    const all = await Promise.all(answers);
    expect(builds).toBe(2);
    expect(all.filter((a) => a.n === 2)).toHaveLength(1);
    expect(all.filter((a) => a.n === 1)).toHaveLength(3);
    expect(settled).not.toBe("waiting");

    clock.now += 6_000; // past the per-instance memo: everyone now reads the new value, without another build
    for (const i of instances) expect((await i.get()).n).toBe(2);
    expect(builds).toBe(2);
  });

  it("hands the last shared value to the builder", async () => {
    const clock = { now: 1_000_000 };
    const { store } = memoryStore(clock);
    const seen: (number | null)[] = [];
    const build = async (previous: { n: number; ok: boolean } | null) => {
      seen.push(previous?.n ?? null);
      return { n: (previous?.n ?? 0) + 1, ok: true };
    };
    const a = snapshot("k", OPTS, build, store, () => clock.now, noWait);
    await a.get();
    clock.now += 61_000;
    const b = snapshot("k", OPTS, build, store, () => clock.now, noWait); // a fresh instance
    expect((await b.get()).n).toBe(2);
    expect(seen).toEqual([null, 1]);
  });

  it("never stores a fallback for everyone, and keeps serving the last good value", async () => {
    const clock = { now: 1_000_000 };
    const { store, calls } = memoryStore(clock);
    let ok = true;
    let builds = 0;
    const build = async () => ({ n: ++builds, ok });
    const a = snapshot("k", OPTS, build, store, () => clock.now, noWait);
    expect((await a.get()).n).toBe(1);

    ok = false;
    clock.now += 61_000;
    expect(await a.get()).toEqual({ n: 1, ok: true }); // the build failed: the last good value is served
    expect(calls.write).toBe(1);

    const b = snapshot("k", OPTS, build, store, () => clock.now, noWait);
    expect((await b.get()).n).toBe(1); // another instance does not retry while the claim is fresh
    expect(builds).toBe(2);

    ok = true;
    clock.now += 46_000; // the claim has lapsed
    const c = snapshot("k", OPTS, build, store, () => clock.now, noWait);
    expect(await c.get()).toEqual({ n: 3, ok: true });
  });

  it("waits for another instance's first build instead of doing the same work", async () => {
    const clock = { now: 1_000_000 };
    const { store } = memoryStore(clock);
    let builds = 0;
    let release: () => void = () => undefined;
    const slow = async () => {
      builds++;
      await new Promise<void>((r) => (release = r));
      return { n: 1, ok: true };
    };
    const a = snapshot("k", OPTS, slow, store, () => clock.now, noWait);
    const first = a.get();
    await Promise.resolve();
    await Promise.resolve();
    const b = snapshot("k", OPTS, slow, store, () => clock.now, async () => release());
    const second = b.get();
    expect(await first).toEqual({ n: 1, ok: true });
    expect(await second).toEqual({ n: 1, ok: true });
    expect(builds).toBe(1);
  });

  it("falls back to one build per instance when the store is down", async () => {
    const clock = { now: 1_000_000 };
    const down: SnapshotStore = {
      read: async () => {
        throw new Error("no database");
      },
      claim: async () => {
        throw new Error("no database");
      },
      write: async () => {
        throw new Error("no database");
      },
    };
    let builds = 0;
    const build = async () => ({ n: ++builds, ok: true });
    const a = snapshot("k", OPTS, build, down, () => clock.now, noWait);
    expect((await a.get()).n).toBe(1);
    clock.now += 6_000;
    expect((await a.get()).n).toBe(1); // within the ttl: no new build
    clock.now += 60_000;
    expect((await a.get()).n).toBe(2);
  });

  it("reuses one read of the row for a few seconds per instance", async () => {
    const clock = { now: 1_000_000 };
    const { store, calls } = memoryStore(clock);
    const a = snapshot("k", OPTS, async () => ({ n: 1, ok: true }), store, () => clock.now, noWait);
    await a.get();
    const before = calls.read;
    await Promise.all([a.get(), a.get(), a.get()]);
    expect(calls.read).toBe(before);
    clock.now += 5_001;
    await a.get();
    expect(calls.read).toBe(before + 1);
  });
});
