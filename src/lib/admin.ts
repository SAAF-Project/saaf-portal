import { getServerSession } from "next-auth";
import { ADMIN_USERNAME, hasAdminToken } from "./admin-auth";
import { authOptions } from "./auth";

/** Admin: MSACC signed in, or a request with the portal's admin token. Every /api/admin route asks this. */
export async function isAdminRequest(req?: Request): Promise<boolean> {
  if (req && hasAdminToken(req.headers.get("authorization"))) return true;
  const session = await getServerSession(authOptions);
  return (session?.user as { githubUsername?: string } | undefined)?.githubUsername === ADMIN_USERNAME;
}

/** The signed-in member's GitHub login, if any. */
export async function sessionLogin(): Promise<string | undefined> {
  const session = await getServerSession(authOptions);
  return (session?.user as { githubUsername?: string } | undefined)?.githubUsername;
}
