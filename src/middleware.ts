import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: { signIn: "/login" },
});

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/profile/:path*",
    "/leaderboard/:path*",
    "/tracks/:path*",
    "/my-repos/:path*",
    "/onboarding/:path*",
    "/e-learning/:path*",
    "/agent-library/:path*",
    "/admin/:path*",
    "/participants/:path*",
  ],
};
