import { timingSafeEqual } from "node:crypto";

/** The grader on Mathijs's Mac sends `Authorization: Bearer <GRADER_TOKEN>`. Without a long token set, nobody gets in. */
export function isGrader(header: string | null, secret: string | undefined = process.env.GRADER_TOKEN): boolean {
  if (!secret || secret.length < 32 || !header?.startsWith("Bearer ")) return false;
  const given = Buffer.from(header.slice(7));
  const want = Buffer.from(secret);
  return given.length === want.length && timingSafeEqual(given, want);
}
