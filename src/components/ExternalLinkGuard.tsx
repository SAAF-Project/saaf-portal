"use client";

import { useEffect, useState } from "react";
import { leavesPortal, linkName } from "../lib/external-links";
import { LeavingNotice, type ExternalReference } from "./ExternalReferences";

// Every link in the portal that opens a site SAAF does not run shows the leaving notice first: the member sees which
// site it is and chooses to continue or to stay. It listens once for the whole page, so a link needs no code of its own.
// The button in the notice carries data-leaving-ok and passes.

export default function ExternalLinkGuard() {
  const [leaving, setLeaving] = useState<ExternalReference | null>(null);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented) return;
      if (event.type === "auxclick" && event.button !== 1) return; // the middle button opens a link too
      const target = event.target instanceof Element ? event.target : null;
      const link = target?.closest<HTMLAnchorElement>("a[href]");
      if (!link || link.hasAttribute("data-leaving-ok") || link.hasAttribute("download")) return;
      const url = leavesPortal(link.getAttribute("href") ?? "", window.location.href);
      if (!url) return;
      event.preventDefault();
      event.stopPropagation();
      setLeaving({ name: linkName(link.textContent, url), url: url.href, text: "" });
    };
    document.addEventListener("click", onClick, true);
    document.addEventListener("auxclick", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("auxclick", onClick, true);
    };
  }, []);

  return leaving ? <LeavingNotice reference={leaving} onClose={() => setLeaving(null)} /> : null;
}
