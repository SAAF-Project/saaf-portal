// What counts as one finding in the Security Challenge (10 November 2026).
// Shown on the quiz and handout pages; keep in step with the handout PDF and the deck.

export const FINDING_RULES: { k: string; v: string }[] = [
  {
    k: "Counts",
    v: "One weakness in one place: a repo plus file, endpoint or site; behaviour that is not what was intended or safe; a plausible security, privacy or audit impact.",
  },
  {
    k: "In scope",
    v: "Repositories in the SAAF-Project org, and their pull requests, that were live before the challenge started at 13:30 today, plus the live SAAF sites. Repos or PRs created today do not count.",
  },
  { k: "Once", v: "The same root cause in one repo counts once." },
  { k: "Per repo", v: "The same issue in three repos counts three times." },
  { k: "Not new", v: "Anything already found before today, false positives, third-party services, repos outside SAAF-Project." },
  {
    k: "Never",
    v: "No live keys or secret values, no personal data, no attacks on live systems. Local copies only; live sites passive only.",
  },
];

export default function FindingRules() {
  return (
    <dl className="border-t border-border">
      {FINDING_RULES.map((r) => (
        <div key={r.k} className="grid grid-cols-[88px_1fr] gap-3 py-2 border-b border-border text-sm">
          <dt className="font-medium">{r.k}</dt>
          <dd className="text-muted leading-relaxed">{r.v}</dd>
        </div>
      ))}
    </dl>
  );
}
