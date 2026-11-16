import { toChecksDoc, type ChecksDoc } from "./day-checks";
import { databaseStore } from "./snapshot-db";

// The track 3 document (src/lib/day-checks.ts) in the database: one row in the snapshot table, used as a plain store.

const KEY = "day-checks-v1";

export async function loadChecks(): Promise<ChecksDoc> {
  const row = await databaseStore.read<unknown>(KEY);
  return toChecksDoc(row?.value ?? null);
}

export async function saveChecks(doc: ChecksDoc): Promise<void> {
  await databaseStore.write(KEY, doc);
}
