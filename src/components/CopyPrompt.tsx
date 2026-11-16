"use client";

import { useState } from "react";

// One button that copies a prompt for a coding assistant, with the prompt itself one click away so you can read what
// you paste. Used for the start of each track on the hardening day (src/lib/day-tracks.ts).
export default function CopyPrompt({ text, label = "Copy the prompt" }: { text: string; label?: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setState("copied");
    } catch {
      setState("failed"); // no clipboard access: the prompt opens below, to copy by hand
    }
    setTimeout(() => setState("idle"), 6000);
  };

  return (
    <div>
      <button type="button" onClick={copy} className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium">
        {state === "copied" ? "Copied" : label}
      </button>
      <p className="text-xs text-muted mt-2 min-h-[1rem]" aria-live="polite">
        {state === "copied" ? "Paste it into your coding assistant, in the repo you work on." : state === "failed" ? "Copying is blocked here. Open the prompt below and copy it by hand." : ""}
      </p>
      <details className="group" open={state === "failed" ? true : undefined}>
        <summary className="cursor-pointer list-none text-xs font-mono text-muted">
          <span className="group-open:hidden">Read the prompt</span>
          <span className="hidden group-open:inline">Hide the prompt</span>
        </summary>
        <pre className="mt-2 p-3 rounded-lg bg-surface2 text-xs font-mono whitespace-pre-wrap [overflow-wrap:anywhere] leading-relaxed">{text}</pre>
      </details>
    </div>
  );
}
