// Which links leave the SAAF portal. Every link to a site SAAF does not run gets the same notice before it opens
// (src/components/ExternalLinkGuard.tsx). SAAF's own sites pass without one.

const OWN_HOSTS = [/(^|\.)saafproject\.com$/i, /^saaf-portal(-[a-z0-9-]+)?\.vercel\.app$/i];

/** The address a link leaves the portal for, or null when it stays inside, is not a web address or is one of SAAF's own sites. */
export function leavesPortal(href: string, here: string): URL | null {
  let url: URL;
  let origin: string;
  try {
    url = new URL(href, here);
    origin = new URL(here).origin;
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.origin === origin) return null;
  if (OWN_HOSTS.some((own) => own.test(url.hostname))) return null;
  return url;
}

/** What to call a link in the notice: its own words without the arrow, or the site it opens. */
export function linkName(text: string | null | undefined, url: URL): string {
  const name = (text ?? "").replace(/[↗\s]+$/u, "").replace(/\s+/g, " ").trim();
  return name && name.length <= 80 ? name : url.host;
}
