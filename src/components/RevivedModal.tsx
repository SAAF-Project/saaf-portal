"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { rememberSeen, seenCount } from "../lib/revived-seen";

/** "You revived an agent." or "You revived 2 agents." */
export function revivedHeadline(count: number): string {
  return count === 1 ? "You revived an agent." : `You revived ${count} agents.`;
}

/** "a", "a and b", "a, b and c". */
export function listNames(names: string[]): string {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/**
 * The message itself: which agents the member revived and where to see them. Closes on the button, on Escape and on a
 * click outside the card; the focus starts on the close button and stays inside the card.
 */
export function RevivedDialog({ repos, onClose }: { repos: string[]; onClose: () => void }) {
  const titleId = useId();
  const cardRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const items = cardRef.current?.querySelectorAll<HTMLElement>("a[href], button");
      if (!items || items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      const outside = !cardRef.current?.contains(active);
      if (e.shiftKey ? active === first || outside : active === last || outside) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const one = repos.length === 1;

  return (
    <div
      className="fixed inset-0 bg-bg/85 z-50 flex items-center justify-center p-4 backdrop-blur-sm motion-safe:animate-fade-in"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div ref={cardRef} role="dialog" aria-modal="true" aria-labelledby={titleId} className="bg-surface border border-border rounded-2xl w-full max-w-md shadow-2xl">
        <div className="p-6">
          <h2 id={titleId} className="text-lg font-medium">{revivedHeadline(repos.length)}</h2>
          <p className="font-mono text-sm mt-3 break-words">{listNames(repos)}</p>
          <p className="text-muted text-sm mt-2">
            {one
              ? "It is on the standards board with all nine standards met, and your name is on it."
              : "They are on the standards board with all nine standards met, and your name is on them."}
          </p>
        </div>
        <div className="flex items-center gap-2 p-4 border-t border-border">
          {/* No colour utility on the link: the unlayered `a` rule in globals.css sets the accent colour and would win anyway. */}
          <Link href="/standards" onClick={onClose} className="text-sm px-4 py-2 rounded-lg border border-border hover:border-accent">
            Open the standards board
          </Link>
          <div className="flex-1" />
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Shown on the dashboard, once, when the member has revived more agents than they were last told about. The count
 * they saw is remembered per GitHub login when the message is closed (src/lib/revived-seen.ts); without storage the
 * message stays closed for this page view only.
 */
export default function RevivedModal({ login, repos }: { login?: string | null; repos?: string[] }) {
  const [closedAt, setClosedAt] = useState(0);
  const names = Array.isArray(repos) ? repos : [];
  const count = names.length;

  const close = useCallback(() => {
    if (login) rememberSeen(login, count);
    setClosedAt(count);
  }, [login, count]);

  if (!login || count === 0 || count <= closedAt || count <= seenCount(login)) return null;
  return <RevivedDialog repos={names} onClose={close} />;
}
