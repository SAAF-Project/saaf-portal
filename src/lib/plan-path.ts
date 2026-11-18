// The portal fetches a plan from the SAAF-Project repo with its own token. The session and the
// slug come from the request, so only a plain name may become part of that path.

/** One part of a plan's path: letters, digits, hyphens and underscores, starting with a letter or a digit. */
const NAME = /^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/;

/** The path of a plan inside the SAAF-Project repo, or null when the session or the slug is not a plain name. */
export function planPath(session: unknown, slug: unknown): string | null {
  if (typeof session !== "string" || typeof slug !== "string") return null;
  if (!NAME.test(session) || !NAME.test(slug)) return null;
  return `plans/${session}/${slug}.md`;
}
