import type { PrismaClient } from "@/generated/prisma/client";

// Write access to someone else's repo during a session: a member asks, Mathijs approves in the admin, and the
// Claude Code session on his Mac grants it with `gh` (the portal's own token is read-only) and marks it granted.
// Always write, never maintain or admin. Stored as Feedback rows per session, so no migration.

export const ACCESS_CATEGORY = "access-2026-11-17";
export const REASONS = ["revive", "merge", "help"] as const;
export const OWNER = ["yes", "no-answer", "not-asked"] as const;
export type Reason = (typeof REASONS)[number];
export type OwnerConsent = (typeof OWNER)[number];
export type AccessStatus = "waiting" | "approved" | "granted" | "refused";

export interface AccessRequest {
  id: string;
  login: string;
  repo: string;
  reason: Reason;
  owner: OwnerConsent;
  note: string;
  status: AccessStatus;
  createdAt: string;
  decidedAt: string | null;
}

interface Stored {
  repo: string;
  reason: Reason;
  owner: OwnerConsent;
  note: string;
  status: AccessStatus;
  decidedAt: string | null;
}

/** Check a request as sent by a member. */
export function validateRequest(body: unknown, repos: string[]): { ok: Stored } | { error: string } {
  const b = (body ?? {}) as Record<string, unknown>;
  const repo = String(b.repo ?? "").replace(/^SAAF-Project\//, "");
  if (!repos.includes(repo)) return { error: "Choose a repo from the board" };
  if (!REASONS.includes(b.reason as Reason)) return { error: "Choose why you need access" };
  if (!OWNER.includes(b.owner as OwnerConsent)) return { error: "Say whether the creator agrees" };
  const note = String(b.note ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 300);
  return { ok: { repo, reason: b.reason as Reason, owner: b.owner as OwnerConsent, note, status: "waiting", decidedAt: null } };
}

function parse(text: string): Stored | null {
  try {
    const v = JSON.parse(text);
    if (typeof v.repo !== "string" || !REASONS.includes(v.reason) || !OWNER.includes(v.owner)) return null;
    const status: AccessStatus = ["waiting", "approved", "granted", "refused"].includes(v.status) ? v.status : "waiting";
    return { repo: v.repo, reason: v.reason, owner: v.owner, note: typeof v.note === "string" ? v.note : "", status, decidedAt: typeof v.decidedAt === "string" ? v.decidedAt : null };
  } catch {
    return null;
  }
}

export async function listRequests(prisma: PrismaClient, login?: string): Promise<AccessRequest[]> {
  const rows = await prisma.feedback.findMany({
    where: { category: ACCESS_CATEGORY, ...(login ? { user: { githubUsername: login } } : {}) },
    include: { user: { select: { githubUsername: true } } },
    orderBy: { createdAt: "asc" },
  });
  return rows
    .map((r) => {
      const v = parse(r.text);
      return v ? { id: r.id, login: r.user.githubUsername, ...v, createdAt: r.createdAt.toISOString() } : null;
    })
    .filter((r): r is AccessRequest => r !== null);
}

/** Move a request on: waiting → approved or refused (the organiser), approved → granted (the Mac, after gh). */
export function nextStatus(from: AccessStatus, action: string): AccessStatus | null {
  if (action === "approve" && (from === "waiting" || from === "refused")) return "approved";
  if (action === "refuse" && (from === "waiting" || from === "approved")) return "refused";
  if (action === "granted" && from === "approved") return "granted";
  return null;
}

export async function setStatus(prisma: PrismaClient, id: string, action: string): Promise<AccessRequest | null> {
  const row = await prisma.feedback.findUnique({ where: { id }, include: { user: { select: { githubUsername: true } } } });
  if (!row || row.category !== ACCESS_CATEGORY) return null;
  const v = parse(row.text);
  if (!v) return null;
  const status = nextStatus(v.status, action);
  if (!status) return null;
  const next = { ...v, status, decidedAt: new Date().toISOString() };
  await prisma.feedback.update({ where: { id }, data: { text: JSON.stringify(next), status: status === "granted" ? "resolved" : "reviewed" } });
  return { id, login: row.user.githubUsername, ...next, createdAt: row.createdAt.toISOString() };
}
