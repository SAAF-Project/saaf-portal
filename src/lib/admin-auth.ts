import { timingSafeEqual } from "node:crypto";

// The portal's one admin token, PORTAL_ADMIN_TOKEN: the private skills on Mathijs's Mac (review agent, pitch check,
// standards review, access grants) use it to manage the portal's data through the /api/admin routes. It opens the admin
// API only, never raw database access. Rotate it after each session.

export const ADMIN_USERNAME = "MSACC";

/** `Authorization: Bearer <PORTAL_ADMIN_TOKEN>`. Without a long token set, nobody gets in this way. */
export function hasAdminToken(header: string | null, secret: string | undefined = process.env.PORTAL_ADMIN_TOKEN): boolean {
  if (!secret || secret.length < 32 || !header?.startsWith("Bearer ")) return false;
  const given = Buffer.from(header.slice(7));
  const want = Buffer.from(secret);
  return given.length === want.length && timingSafeEqual(given, want);
}
