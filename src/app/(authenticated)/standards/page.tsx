import Link from "next/link";
import AccessRequest from "@/components/AccessRequest";
import DayCountdown from "@/components/DayCountdown";
import OrganiserView from "@/components/OrganiserView";
import StandardsBoard from "@/components/temple/standards/StandardsBoard";
import { sessionLogin } from "@/lib/admin";
import { ASSIGNMENT_OPENS_CLOCK, previewing, seesAssignment } from "@/lib/day-gate";

// The standards board of the hardening day (Session 11, 17 November 2026): every repo of the organisation by the nine
// standards of src/components/temple/standards/standards.ts. Made to be shown on the big screen and read on a phone.
export default async function StandardsPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const login = await sessionLogin();
  const asMember = (await searchParams).view === "member";
  const open = seesAssignment(login, asMember);
  return (
    <div className="py-8">
      {previewing(login) && <OrganiserView path="/standards" asMember={asMember} />}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/saaf-lockup-ink.png" alt="SAAF, Shared Audit Agents Framework" className="h-6 w-auto dark:invert" />
        <Link href="/hardening" className="text-sm px-4 py-2 rounded-lg border border-border hover:border-accent">
          {open ? "The three tracks and how to start" : "The hardening day"}
        </Link>
      </div>

      <p className="text-xs font-mono text-muted mb-2">Session #11 · Hardening day · 17 November 2026</p>
      <h1 className="text-3xl font-medium leading-tight mb-6">The standards board.</h1>

      {!open && (
        <>
          <p className="text-muted leading-relaxed mb-6 max-w-[680px]">
            The leaderboard of the hardening day and the assignment open at {ASSIGNMENT_OPENS_CLOCK} on 17 November. Below: where every repo stands today.
          </p>
          <DayCountdown />
        </>
      )}
      <StandardsBoard showDay={open} />

      <details className="group my-6">
        <summary className="cursor-pointer list-none text-sm font-medium">
          Work on a repo that is not yours. <span className="font-mono text-xs text-muted group-open:hidden">show</span>
          <span className="font-mono text-xs text-muted hidden group-open:inline">hide</span>
        </summary>
        <AccessRequest />
      </details>

      <p className="text-xs text-muted leading-relaxed mt-6 max-w-[680px]">
        The board reads the default branch of every repo in the SAAF-Project organisation that is not archived, once a
        minute. A standard counts once a pull request is merged into the default branch; what came in since 09:00 on the day glows. What each standard asks for is on the{" "}
        <Link href="/hardening" className="text-accent hover:underline">handout</Link>.
      </p>
    </div>
  );
}
