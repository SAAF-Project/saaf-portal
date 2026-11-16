// The assignment of the hardening day (the three tracks, the start prompts, the rules, the handout and the demo
// sign-up) opens in the portal at 09:00 on the day. Before that members see the programme only. The organiser sees
// everything from the start, and can look at a page the way a member sees it with ?view=member.
//
// No imports: the middleware uses this too, and that runs without Node's modules.

/** 09:00 in Amsterdam on 17 November 2026 (UTC+1). */
export const ASSIGNMENT_OPENS_AT = "2026-11-17T08:00:00Z";
export const ASSIGNMENT_OPENS_CLOCK = "09:00";
/** The organiser's GitHub login. The same as ADMIN_USERNAME in admin-auth.ts; a test keeps them in step. */
export const ORGANISER_LOGIN = "MSACC";

export const assignmentOpen = (now: number = Date.now()): boolean => now >= Date.parse(ASSIGNMENT_OPENS_AT);

/** Whether this visitor sees the assignment: everyone once it is open; before that only the organiser, unless looking as a member. */
export function seesAssignment(login: string | null | undefined, asMember = false, now: number = Date.now()): boolean {
  return assignmentOpen(now) || (login === ORGANISER_LOGIN && !asMember);
}

/** The organiser before the opening: the pages then offer both views. */
export const previewing = (login: string | null | undefined, now: number = Date.now()): boolean => login === ORGANISER_LOGIN && !assignmentOpen(now);
