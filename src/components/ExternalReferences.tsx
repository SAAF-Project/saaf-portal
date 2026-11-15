"use client";

import { useEffect, useRef, useState } from "react";

// A list of references to sites the SAAF portal does not run. A reference never opens straight away: the member first
// sees which site it is and chooses to continue or to stay.

export interface ExternalReference {
  name: string;
  /** Full address, https only. */
  url: string;
  text: string;
}

export function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

export function LeavingNotice({ reference, onClose }: { reference: ExternalReference; onClose: () => void }) {
  const stay = useRef<HTMLButtonElement>(null);
  const host = hostOf(reference.url);

  useEffect(() => {
    stay.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="leaving-title"
        className="w-full max-w-md bg-surface border border-border rounded-2xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="leaving-title" className="text-lg font-medium mb-2">
          You are leaving the SAAF portal.
        </h2>
        <p className="text-sm text-muted leading-relaxed mb-1">
          {reference.name} opens <span className="font-mono text-xs">{host}</span>, an external site that SAAF does not run.
        </p>
        <p className="text-sm text-muted leading-relaxed mb-5">
          Its own terms and privacy rules apply there. Do not enter keys or real audit data unless you mean to.
        </p>
        <div className="flex flex-wrap items-center justify-end gap-3">
          <button
            ref={stay}
            type="button"
            onClick={onClose}
            className="text-sm px-4 py-2 rounded-lg border border-border hover:border-accent"
          >
            Stay here
          </button>
          <a
            href={reference.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onClose}
            className="text-sm px-4 py-2 rounded-lg border border-accent hover:underline"
          >
            Continue to {host}
          </a>
        </div>
      </div>
    </div>
  );
}

export default function ExternalReferences({ references }: { references: ExternalReference[] }) {
  const [open, setOpen] = useState<ExternalReference | null>(null);

  return (
    <>
      <ul className="border-t border-border">
        {references.map((r) => (
          <li key={r.url} className="border-b border-border">
            <button
              type="button"
              onClick={() => setOpen(r)}
              className="w-full text-left grid sm:grid-cols-[160px_1fr_auto] gap-x-3 gap-y-1 py-2 text-sm hover:bg-surface"
            >
              <span className="font-medium">{r.name}</span>
              <span className="text-muted leading-relaxed">{r.text}</span>
              <span className="font-mono text-xs text-muted whitespace-nowrap">{hostOf(r.url)} · external site</span>
            </button>
          </li>
        ))}
      </ul>
      {open && <LeavingNotice reference={open} onClose={() => setOpen(null)} />}
    </>
  );
}
