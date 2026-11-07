import { describe, expect, it } from "vitest";
import { fetchJson, fetchList } from "./fetch-json";

const answer = (status: number, body: unknown) => (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;
const broken = (async () => {
  throw new Error("offline");
}) as unknown as typeof fetch;

describe("fetchJson", () => {
  it("returns the body of a successful call", async () => {
    expect(await fetchJson("/api/x", answer(200, { badges: [] }))).toEqual({ badges: [] });
  });

  it("returns null for an error status instead of the error object (#16)", async () => {
    expect(await fetchJson("/api/achievements", answer(401, { error: "Unauthorized" }))).toBeNull();
    expect(await fetchJson("/api/profile", answer(404, { error: "User not found" }))).toBeNull();
  });

  it("returns null when the network call fails", async () => {
    expect(await fetchJson("/api/x", broken)).toBeNull();
  });
});

describe("fetchList", () => {
  it("returns the list, or an empty list for errors and non-lists", async () => {
    expect(await fetchList("/api/data/plans", answer(200, [{ slug: "a" }]))).toEqual([{ slug: "a" }]);
    expect(await fetchList("/api/data/plans", answer(401, { error: "Unauthorized" }))).toEqual([]);
    expect(await fetchList("/api/data/plans", answer(200, { error: "odd" }))).toEqual([]);
  });
});
