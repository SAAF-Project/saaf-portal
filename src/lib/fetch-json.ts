/**
 * GET a JSON endpoint from the browser. Returns null when the call fails or the server answers with an error status
 * (for example 401 or 404 when the session has no GitHub username), so a page can render without that part instead of
 * crashing on an error object (#16).
 */
export async function fetchJson<T>(url: string, fetchImpl: typeof fetch = fetch): Promise<T | null> {
  try {
    const res = await fetchImpl(url);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** Like fetchJson, for endpoints that return a list: anything that is not an array becomes an empty list. */
export async function fetchList<T>(url: string, fetchImpl: typeof fetch = fetch): Promise<T[]> {
  const value = await fetchJson<unknown>(url, fetchImpl);
  return Array.isArray(value) ? (value as T[]) : [];
}
