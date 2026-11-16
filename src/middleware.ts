import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import { ORGANISER_LOGIN, assignmentOpen } from "./lib/day-gate";

// Signed-in members only, for every page below. One file is held back as well: the handout of the hardening day is a
// PDF in public/hardening/, and before the assignment opens only the organiser may fetch it.
export default withAuth(
  function middleware(req) {
    const path = req.nextUrl.pathname;
    if (path.startsWith("/hardening/") && path.endsWith(".pdf") && !assignmentOpen() && req.nextauth.token?.githubUsername !== ORGANISER_LOGIN) {
      return NextResponse.redirect(new URL("/hardening", req.url));
    }
    return NextResponse.next();
  },
  { pages: { signIn: "/login" } },
);

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/profile/:path*",
    "/leaderboard/:path*",
    "/tracks/:path*",
    "/visualised/:path*",
    "/my-repos/:path*",
    "/onboarding/:path*",
    "/e-learning/:path*",
    "/agent-library/:path*",
    "/open-source/:path*",
    "/admin/:path*",
    "/participants/:path*",
    "/about/:path*",
    "/sessions/:path*",
    "/demo/:path*",
    "/challenge/:path*",
    "/hardening/:path*",
    "/standards/:path*",
  ],
};
