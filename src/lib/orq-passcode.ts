// The passcode of the Orq.ai onboarding site (saaf-project.orq.ai). It never lives in this repository, which is public:
// the organisers set ORQ_PASSCODE on the server, and the hardening page shows it to signed-in members once the
// assignment is open. Without the variable the page says what it always said.

/** The sentence in the Orq.ai onboarding reference that the passcode replaces. */
export const PASSCODE_IN_THE_ROOM = "The passcode is shared in the room.";

const SAFE = /^[\x21-\x7e]{1,60}$/; // one word of printable characters, no spaces

export function orqPasscode(env: Record<string, string | undefined> = process.env): string | null {
  const value = (env.ORQ_PASSCODE ?? "").trim();
  return SAFE.test(value) ? value : null;
}

/** The text of the onboarding reference: with the passcode when there is one to show, unchanged otherwise. */
export function orqOnboardingText(text: string, passcode: string | null): string {
  return passcode ? text.replace(PASSCODE_IN_THE_ROOM, `Passcode: ${passcode}.`) : text;
}
