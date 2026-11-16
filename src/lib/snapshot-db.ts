import { getPrisma } from "./prisma";
import type { Row, SnapshotStore } from "./snapshot";

// The shared snapshots (src/lib/snapshot.ts) in the portal's own database: one row per key. Raw SQL: the table has no
// Prisma model and is created here on first use (CREATE TABLE IF NOT EXISTS), like the tables in leaderboard-store.ts.
// All times are the database's own clock, so server instances never have to agree on the time.

const DDL = `CREATE TABLE IF NOT EXISTS "Snapshot" (
  "key" TEXT NOT NULL,
  "payload" JSONB,
  "builtAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "claimedAt" TIMESTAMPTZ,
  CONSTRAINT "Snapshot_pkey" PRIMARY KEY ("key")
)`;

let ensured: Promise<void> | null = null;

function ensureTable(): Promise<void> {
  if (!ensured) {
    ensured = getPrisma()
      .$executeRawUnsafe(DDL)
      .then(() => undefined)
      .catch((e) => {
        ensured = null;
        throw e;
      });
  }
  return ensured;
}

/** The store in the portal's own database. Raw SQL: the table has no Prisma model and is created on first use. */
export const databaseStore: SnapshotStore = {
  async read<T>(key: string): Promise<Row<T> | null> {
    await ensureTable();
    const rows = await getPrisma().$queryRawUnsafe<{ payload: T | null; ageMs: number }[]>(
      `SELECT "payload", (EXTRACT(EPOCH FROM (now() - "builtAt")) * 1000)::float8 AS "ageMs" FROM "Snapshot" WHERE "key" = $1`,
      key,
    );
    return rows.length ? { value: rows[0].payload ?? null, ageMs: Number(rows[0].ageMs) } : null;
  },
  async claim(key: string, ttlMs: number, claimMs: number): Promise<boolean> {
    await ensureTable();
    const rows = await getPrisma().$queryRawUnsafe<{ key: string }[]>(
      `INSERT INTO "Snapshot" ("key", "payload", "builtAt", "claimedAt") VALUES ($1, NULL, to_timestamp(0), now())
       ON CONFLICT ("key") DO UPDATE SET "claimedAt" = now()
       WHERE ("Snapshot"."payload" IS NULL OR "Snapshot"."builtAt" < now() - ($2::int * interval '1 millisecond'))
         AND ("Snapshot"."claimedAt" IS NULL OR "Snapshot"."claimedAt" < now() - ($3::int * interval '1 millisecond'))
       RETURNING "key"`,
      key,
      Math.round(ttlMs),
      Math.round(claimMs),
    );
    return rows.length > 0;
  },
  async write<T>(key: string, value: T): Promise<void> {
    await ensureTable();
    await getPrisma().$executeRawUnsafe(
      `INSERT INTO "Snapshot" ("key", "payload", "builtAt", "claimedAt") VALUES ($1, $2::jsonb, now(), NULL)
       ON CONFLICT ("key") DO UPDATE SET "payload" = EXCLUDED."payload", "builtAt" = now(), "claimedAt" = NULL`,
      key,
      JSON.stringify(value),
    );
  },
};
