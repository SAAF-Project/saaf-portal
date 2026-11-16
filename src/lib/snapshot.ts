// A value that every server instance shares, kept in one database row per key. One instance at a time builds the next
// value; the others keep serving the last one. So however many instances and open tabs there are, the work behind the
// value (calls to GitHub) happens about once per `ttlMs`, and a fresh instance starts from what the others found.
// Without the database it falls back to one build per instance, as before. The store in the portal's database is in
// src/lib/snapshot-db.ts; this file has no imports, so it can be tested on its own.

export interface Row<T> {
  /** `null` = the row is there (someone claimed it) but no value was written yet. */
  value: T | null;
  /** How old the value is, by the database's clock. */
  ageMs: number;
}

export interface SnapshotStore {
  read<T>(key: string): Promise<Row<T> | null>;
  /** True when the caller may build: there is no value younger than `ttlMs` and nobody claimed it in the last `claimMs`. */
  claim(key: string, ttlMs: number, claimMs: number): Promise<boolean>;
  write<T>(key: string, value: T): Promise<void>;
}

export interface SnapshotOptions<T> {
  /** How old the shared value may get before someone builds a new one. */
  ttlMs: number;
  /** How long a build may take before another instance may try. */
  claimMs?: number;
  /** Per instance: how long one read of the row is reused. */
  memoMs?: number;
  /** How long to wait for another instance's first build before building here. */
  waitMs?: number;
  /** A fallback (no answer, a stale answer) is served to the caller but never stored for everyone. */
  usable: (value: T) => boolean;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export interface Snapshot<T> {
  get(): Promise<T>;
  /** Per instance: read the row again on the next call. */
  forget(): void;
}

/**
 * `build` gets the last shared value (or `null`), so it can start from what is already known. It should not throw;
 * when it does, the last shared value is served if there is one.
 */
export function snapshot<T>(
  key: string,
  opts: SnapshotOptions<T>,
  build: (previous: T | null) => Promise<T>,
  store: SnapshotStore,
  now: () => number = Date.now,
  wait: (ms: number) => Promise<void> = sleep,
): Snapshot<T> {
  const claimMs = opts.claimMs ?? 45_000;
  const memoMs = opts.memoMs ?? 5_000;
  const waitMs = opts.waitMs ?? 9_000;
  let memo: { at: number; value: Promise<T> } | null = null;
  let own: { at: number; value: T } | null = null;

  // Without the store: one build per instance per ttl, never stored for the others.
  async function local(previous: T | null): Promise<T> {
    if (own && now() - own.at < opts.ttlMs) return own.value;
    const value = await build(previous ?? own?.value ?? null);
    if (opts.usable(value)) own = { at: now(), value };
    return opts.usable(value) ? value : (own?.value ?? value);
  }

  async function load(): Promise<T> {
    let row: Row<T> | null;
    try {
      row = await store.read<T>(key);
    } catch {
      return local(null);
    }
    const last = row?.value ?? null;
    if (last !== null && row!.ageMs < opts.ttlMs) return last;

    let mine: boolean;
    try {
      mine = await store.claim(key, opts.ttlMs, claimMs);
    } catch {
      return local(last);
    }
    if (!mine) {
      if (last !== null) return last; // someone else is building: serve the last value meanwhile
      // Nothing yet and another instance is building the first value: wait for it instead of doing the same work.
      for (let waited = 0; waited < waitMs; waited += 1_500) {
        await wait(1_500);
        const again = await store.read<T>(key).catch(() => null);
        if (again && again.value !== null) return again.value;
      }
      return local(null);
    }

    let built: T;
    try {
      built = await build(last);
    } catch (e) {
      if (last !== null) return last;
      throw e;
    }
    if (!opts.usable(built)) return last ?? built; // the claim lapses by itself; the next try comes after claimMs
    await store.write(key, built).catch(() => undefined);
    return built;
  }

  return {
    get(): Promise<T> {
      if (memo && now() - memo.at < memoMs) return memo.value;
      const entry = { at: now(), value: load() };
      memo = entry;
      entry.value.catch(() => {
        if (memo === entry) memo = null;
      });
      return entry.value;
    },
    forget(): void {
      memo = null;
    },
  };
}
