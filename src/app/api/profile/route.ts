import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";

async function getSessionUser() {
  const session = await getServerSession(authOptions);
  const username = (session?.user as { githubUsername?: string })
    ?.githubUsername;
  if (!username) return null;
  return getPrisma().user.findUnique({ where: { githubUsername: username } });
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(user);
}

const VALID_ROLES = ["Auditor", "Vaktechniek", "Analyst", "Engineer"];
const VALID_TRACKS = [
  "0",
  "1a",
  "1b",
  "2",
  "3a",
  "3b",
  "4",
  "5",
  "",
];

export async function PUT(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();

  const data: Record<string, unknown> = {};

  if (body.name !== undefined) data.name = String(body.name).slice(0, 200);
  if (body.organisation !== undefined)
    data.organisation = String(body.organisation).slice(0, 200);
  if (body.role !== undefined && VALID_ROLES.includes(body.role))
    data.role = body.role;
  if (body.preferredTrack !== undefined && VALID_TRACKS.includes(body.preferredTrack))
    data.preferredTrack = body.preferredTrack || null;
  if (body.secondTrack !== undefined && VALID_TRACKS.includes(body.secondTrack))
    data.secondTrack = body.secondTrack || null;

  for (const skill of [
    "skillPrompts",
    "skillTools",
    "skillRegulatory",
    "skillOutputs",
  ]) {
    if (body[skill] !== undefined) {
      const val = parseInt(body[skill]);
      if (val >= 1 && val <= 5) data[skill] = val;
    }
  }

  if (body.companyLogoUrl !== undefined) {
    const logoUrl = body.companyLogoUrl ? String(body.companyLogoUrl).trim() : "";
    if (!logoUrl) {
      data.companyLogoUrl = null;
    } else {
      try {
        const parsed = new URL(logoUrl);
        const isHttps = parsed.protocol === "https:";
        const hasImageExt = /\.(png|jpg|jpeg|svg|webp)$/i.test(parsed.pathname);
        if (isHttps && hasImageExt) {
          data.companyLogoUrl = logoUrl.slice(0, 500);
        }
      } catch {
        // invalid URL, skip
      }
    }
  }
  if (body.showLogoOnWebsite !== undefined)
    data.showLogoOnWebsite = Boolean(body.showLogoOnWebsite);

  const updated = await getPrisma().user.update({
    where: { id: user.id },
    data,
  });

  return NextResponse.json(updated);
}
