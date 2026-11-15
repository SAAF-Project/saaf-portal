// How many revived agents a member has already been told about, so the dashboard says it once per new one.
// A per-viewer convenience in localStorage, kept per GitHub login. Every access is guarded: without storage the
// answer is 0, and the dashboard then shows the message at each visit until it is closed.
// No imports and no Node APIs: this is read by a client component.

type SeenStorage = Pick<Storage, "getItem" | "setItem">;

const KEY = "saaf-revived-seen";
const keyFor = (login: string): string => `${KEY}:${login.toLowerCase()}`;

function browserStorage(): SeenStorage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

/** The revived count this member last saw the message for. 0 = never, or no storage. */
export function seenCount(login: string, storage: SeenStorage | null = browserStorage()): number {
  try {
    const n = Number.parseInt(storage?.getItem(keyFor(login)) ?? "", 10);
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

/**
 * Remember that the member saw the message for `count` agents. The number only goes up: a count that drops for a
 * while (GitHub gave no answer, so nothing counts as revived for now) must not bring the message back afterwards.
 */
export function rememberSeen(login: string, count: number, storage: SeenStorage | null = browserStorage()): void {
  try {
    if (storage && count > seenCount(login, storage)) storage.setItem(keyFor(login), String(count));
  } catch {
    // no storage: the message shows again at the next visit
  }
}
