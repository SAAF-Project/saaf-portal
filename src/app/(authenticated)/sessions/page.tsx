import Link from "next/link";

// Earlier sessions: the handouts of past SAAF sessions, so they stay findable after the day. Only totals and public
// material here; never repo names with findings or classes of secrets.

const SESSIONS = [
  {
    date: "17 November 2026",
    title: "Hardening day",
    place: "TAG, The Stack, Amsterdam · BDO, title sponsor",
    text: "Every agent through the nine quality standards, scored on content by a review agent.",
    links: [
      { href: "/hardening", label: "Handout" },
      { href: "/standards", label: "Standards board" },
    ],
  },
  {
    date: "10 November 2026",
    title: "Security Challenge",
    place: "Mollie, Amsterdam",
    text: "Ten teams looked for weaknesses in the SAAF repositories and built guards against them: 529 distinct findings, 402 of them new, and 15 new repositories.",
    links: [
      { href: "/challenge", label: "Handout" },
      { href: "/challenge/saaf-security-challenge-handout.pdf", label: "PDF" },
    ],
  },
];

export default function SessionsPage() {
  return (
    <div className="py-8 max-w-[760px]">
      <p className="text-xs font-mono text-muted mb-2">SAAF sessions 2026</p>
      <h1 className="text-3xl font-medium leading-tight mb-6">Earlier sessions.</h1>
      <ol className="border-t border-border">
        {SESSIONS.map((s) => (
          <li key={s.date} className="py-4 border-b border-border grid gap-1 sm:grid-cols-[160px_1fr]">
            <span className="font-mono text-xs text-muted pt-1">{s.date}</span>
            <span>
              <span className="block font-medium">{s.title}</span>
              <span className="block text-xs text-muted mb-1">{s.place}</span>
              <span className="block text-sm text-muted leading-relaxed">{s.text}</span>
              <span className="flex gap-4 mt-2 text-sm">
                {s.links.map((l) => (
                  <Link key={l.href} href={l.href} className="text-accent hover:underline">
                    {l.label}
                  </Link>
                ))}
              </span>
            </span>
          </li>
        ))}
      </ol>
      <p className="text-xs text-muted mt-4">
        Earlier handouts (sessions 6, 7 and 9) are in the SAAF-Project repository under docs/handouts.
      </p>
    </div>
  );
}
