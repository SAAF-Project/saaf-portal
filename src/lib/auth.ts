import type { NextAuthOptions } from "next-auth";
import GitHubProvider from "next-auth/providers/github";
import { getPrisma } from "./prisma";
import { isOrgMember } from "./github";
import { matchCompanyLogo } from "./logo-match";

export const authOptions: NextAuthOptions = {
  providers: [
    GitHubProvider({
      clientId: process.env.GITHUB_ID!,
      clientSecret: process.env.GITHUB_SECRET!,
      authorization: { params: { scope: "read:org" } },
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      const ghProfile = profile as { login?: string };
      const username = ghProfile?.login;
      if (!username) return false;

      const isMember = await isOrgMember(username);
      if (!isMember) return `/login?error=not-member&username=${encodeURIComponent(username)}`;

      const githubId = Number(account?.providerAccountId);

      // Look up by githubId first (immutable), then fall back to username.
      // Username lookup alone breaks when someone renames their GitHub account.
      let existingUser =
        await getPrisma().user.findUnique({ where: { githubId } }) ??
        await getPrisma().user.findUnique({ where: { githubUsername: username } });

      if (!existingUser) {
        await getPrisma().user.create({
          data: {
            githubId,
            githubUsername: username,
            name: user.name || username,
            email: user.email,
            avatarUrl: user.image,
          },
        });
      } else {
        const updates: Record<string, unknown> = {};
        // Sync githubId / username in case either changed
        if (existingUser.githubId !== githubId) updates.githubId = githubId;
        if (existingUser.githubUsername !== username) updates.githubUsername = username;
        if (!existingUser.avatarUrl && user.image) updates.avatarUrl = user.image;
        if (!existingUser.companyLogoUrl && existingUser.organisation) {
          const logo = matchCompanyLogo(existingUser.organisation);
          if (logo) {
            updates.companyLogoUrl = logo;
            updates.showLogoOnWebsite = true;
          }
        }
        if (Object.keys(updates).length > 0) {
          await getPrisma().user.update({
            where: { id: existingUser.id },
            data: updates,
          });
        }
      }

      return true;
    },
    async jwt({ token, account, profile }) {
      if (account && profile) {
        const ghProfile = profile as { login?: string };
        token.githubUsername = ghProfile?.login;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.githubUsername) {
        (session.user as { githubUsername?: string }).githubUsername =
          token.githubUsername as string;

        const dbUser = await getPrisma().user.findUnique({
          where: { githubUsername: token.githubUsername as string },
        });
        if (dbUser) {
          (session.user as { dbId?: string }).dbId = dbUser.id;
        }
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
};
