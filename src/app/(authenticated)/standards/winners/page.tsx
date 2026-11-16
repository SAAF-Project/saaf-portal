import WinnersScreen from "@/components/temple/standards/WinnersScreen";
import { sessionLogin } from "@/lib/admin";
import { seesAssignment } from "@/lib/day-gate";

// The winners view of the hardening day (Session 11, 17 November 2026): the big-screen page of the prize-giving. The
// organisers open it from the admin and reveal step by step there; this page shows only what is revealed. Signed-in
// members only (src/middleware.ts covers /standards), and nothing of the day before the assignment opens.
export default async function WinnersPage() {
  return <WinnersScreen open={seesAssignment(await sessionLogin())} />;
}
