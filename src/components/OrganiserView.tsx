import Link from "next/link";
import { ASSIGNMENT_OPENS_CLOCK } from "../lib/day-gate";

// Shown to the organiser only, and only before the assignment opens: which of the two views this is, and the way to
// the other one.
export default function OrganiserView({ path, asMember }: { path: string; asMember: boolean }) {
  return (
    <p className="mb-6 px-4 py-3 rounded-lg border border-dashed border-border text-sm flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
      <span>
        {asMember
          ? `Participant view: this is what members see until ${ASSIGNMENT_OPENS_CLOCK} on 17 November.`
          : `Organiser view: members see this page from ${ASSIGNMENT_OPENS_CLOCK} on 17 November.`}
      </span>
      <Link href={asMember ? path : `${path}?view=member`} className="text-accent hover:underline whitespace-nowrap">
        {asMember ? "Back to the organiser view" : "View as participant"}
      </Link>
    </p>
  );
}
