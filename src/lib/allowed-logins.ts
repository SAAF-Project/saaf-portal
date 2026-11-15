/**
 * Acceptance environment: when ALLOWED_LOGINS is set (GitHub logins, comma-separated), only those members may sign in.
 * Production leaves it unset, so every member of the organisation may sign in.
 */
export function isAllowedLogin(login: string, allowed: string | undefined = process.env.ALLOWED_LOGINS): boolean {
  const list = (allowed ?? "")
    .split(",")
    .map((name) => name.trim().replace(/^@/, "").toLowerCase())
    .filter(Boolean);
  return list.length === 0 || list.includes(login.toLowerCase());
}
