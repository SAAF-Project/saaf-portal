import type { PrismaClient } from "@/generated/prisma/client";
import type { Levels } from "./leaderboard";
import { LEVEL_MAX } from "./leaderboard";

// Storage for the hardening day: the grader's levels per tree SHA and the organisers' controls. The tables are created
// here on first use (CREATE TABLE IF NOT EXISTS, additions only), with exactly the columns of the Prisma models
// ContentGrade and LeaderboardState in prisma/schema.prisma, so they exist without a migration. Keep both in step.

const DAY_ID = "hardening-2026-11-17";
const SCORED = Object.keys(LEVEL_MAX).filter((id) => LEVEL_MAX[id] > 0);

const DDL = [
  `CREATE TABLE IF NOT EXISTS "ContentGrade" (
    "id" TEXT NOT NULL,
    "repo" TEXT NOT NULL,
    "tree" TEXT NOT NULL,
    "standard" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "evidence" JSONB,
    "feedback" TEXT,
    "flags" JSONB,
    "runId" TEXT NOT NULL,
    "gradedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "override" INTEGER,
    "note" TEXT,
    CONSTRAINT "ContentGrade_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "ContentGrade_repo_tree_standard_key" ON "ContentGrade"("repo", "tree", "standard")`,
  `CREATE TABLE IF NOT EXISTS "LeaderboardState" (
    "id" TEXT NOT NULL,
    "frozen" BOOLEAN NOT NULL DEFAULT false,
    "freezeAt" TIMESTAMP(3),
    "revealStep" INTEGER NOT NULL DEFAULT 0,
    "disqualified" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LeaderboardState_pkey" PRIMARY KEY ("id")
  )`,
];

let ensured: Promise<void> | null = null;

/** Create the two tables if they are not there yet. Once per server instance. */
export function ensureTables(prisma: PrismaClient): Promise<void> {
  if (!ensured) {
    ensured = (async () => {
      for (const sql of DDL) await prisma.$executeRawUnsafe(sql);
    })().catch((e) => {
      ensured = null;
      throw e;
    });
  }
  return ensured;
}

export interface GradeIn {
  repo: string;
  tree: string;
  standard: string;
  level: number;
  evidence?: unknown;
  feedback?: string | null;
  flags?: string[];
}

/** Check what the grader sends: known standards, levels in range, sane strings. Returns the bad rows' reasons. */
export function validateGrades(rows: unknown): { ok: GradeIn[]; errors: string[] } {
  const ok: GradeIn[] = [];
  const errors: string[] = [];
  if (!Array.isArray(rows)) return { ok, errors: ["grades must be an array"] };
  rows.forEach((r, i) => {
    const g = r as Partial<GradeIn>;
    if (typeof g.repo !== "string" || !/^[\w.-]{1,100}$/.test(g.repo)) return void errors.push(`${i}: repo`);
    if (typeof g.tree !== "string" || !/^[0-9a-f]{40}$/.test(g.tree)) return void errors.push(`${i}: tree`);
    if (typeof g.standard !== "string" || !(g.standard in LEVEL_MAX)) return void errors.push(`${i}: standard`);
    if (typeof g.level !== "number" || !Number.isInteger(g.level) || g.level < 0 || g.level > LEVEL_MAX[g.standard]) return void errors.push(`${i}: level`);
    ok.push({
      repo: g.repo,
      tree: g.tree,
      standard: g.standard,
      level: g.level,
      evidence: g.evidence ?? null,
      feedback: typeof g.feedback === "string" ? g.feedback.slice(0, 300) : null,
      flags: Array.isArray(g.flags) ? g.flags.filter((f): f is string => typeof f === "string").slice(0, 10).map((f) => f.slice(0, 200)) : [],
    });
  });
  return { ok, errors };
}

/** Save one run of the grader. A level an organiser has overridden stays overridden. */
export async function saveGrades(prisma: PrismaClient, runId: string, rows: GradeIn[]): Promise<number> {
  await ensureTables(prisma);
  const now = new Date();
  await prisma.$transaction(
    rows.map((g) =>
      prisma.contentGrade.upsert({
        where: { repo_tree_standard: { repo: g.repo, tree: g.tree, standard: g.standard } },
        create: { repo: g.repo, tree: g.tree, standard: g.standard, level: g.level, evidence: g.evidence ?? undefined, feedback: g.feedback, flags: g.flags ?? [], runId, gradedAt: now },
        update: { level: g.level, evidence: g.evidence ?? undefined, feedback: g.feedback, flags: g.flags ?? [], runId, gradedAt: now },
      }),
    ),
  );
  return rows.length;
}

export interface Graded {
  levels: Levels;
  gradedAt: string;
  feedback: Record<string, string>;
  flags: Record<string, string[]>;
  evidence: Record<string, unknown>;
  overridden: string[];
}

export const stateKey = (repo: string, tree: string) => `${repo}:${tree}`;

/**
 * Every fully graded state, by repo and tree. A state counts as graded once all scored standards have a level.
 * `until` leaves out grades given after that moment (the public board while it is frozen).
 */
export async function loadGrades(prisma: PrismaClient, until?: Date): Promise<Map<string, Graded>> {
  await ensureTables(prisma);
  const rows = await prisma.contentGrade.findMany({
    where: until ? { gradedAt: { lte: until } } : undefined,
    select: { repo: true, tree: true, standard: true, level: true, override: true, feedback: true, flags: true, evidence: true, gradedAt: true },
  });
  const out = new Map<string, Graded>();
  for (const r of rows) {
    const key = stateKey(r.repo, r.tree);
    const g = out.get(key) ?? { levels: {}, gradedAt: r.gradedAt.toISOString(), feedback: {}, flags: {}, evidence: {}, overridden: [] };
    g.levels[r.standard] = r.override ?? r.level;
    if (r.override !== null) g.overridden.push(r.standard);
    if (r.feedback) g.feedback[r.standard] = r.feedback;
    if (Array.isArray(r.flags) && r.flags.length > 0) g.flags[r.standard] = r.flags as string[];
    if (r.evidence) g.evidence[r.standard] = r.evidence;
    if (r.gradedAt.toISOString() > g.gradedAt) g.gradedAt = r.gradedAt.toISOString();
    out.set(key, g);
  }
  for (const [k, g] of out) if (!SCORED.every((id) => id in g.levels)) out.delete(k);
  return out;
}

export interface BoardState {
  frozen: boolean;
  freezeAt: string | null;
  revealStep: number;
  disqualified: string[];
}

export async function getState(prisma: PrismaClient): Promise<BoardState> {
  await ensureTables(prisma);
  const s = await prisma.leaderboardState.findUnique({ where: { id: DAY_ID }, select: { frozen: true, freezeAt: true, revealStep: true, disqualified: true } });
  return {
    frozen: s?.frozen ?? false,
    freezeAt: s?.freezeAt?.toISOString() ?? null,
    revealStep: s?.revealStep ?? 0,
    disqualified: Array.isArray(s?.disqualified) ? (s!.disqualified as string[]) : [],
  };
}

export async function setState(prisma: PrismaClient, patch: Partial<BoardState>): Promise<BoardState> {
  await ensureTables(prisma);
  const data = {
    ...(patch.frozen !== undefined ? { frozen: patch.frozen } : {}),
    ...(patch.freezeAt !== undefined ? { freezeAt: patch.freezeAt ? new Date(patch.freezeAt) : null } : {}),
    ...(patch.revealStep !== undefined ? { revealStep: Math.max(0, patch.revealStep) } : {}),
    ...(patch.disqualified !== undefined ? { disqualified: patch.disqualified } : {}),
    updatedAt: new Date(),
  };
  await prisma.leaderboardState.upsert({ where: { id: DAY_ID }, create: { id: DAY_ID, ...data }, update: data });
  return getState(prisma);
}

/** An organiser sets a level by hand (or clears it with null), with a note. */
export async function overrideGrade(prisma: PrismaClient, repo: string, tree: string, standard: string, level: number | null, note: string): Promise<number> {
  await ensureTables(prisma);
  const r = await prisma.contentGrade.updateMany({ where: { repo, tree, standard }, data: { override: level, note: note.slice(0, 300) } });
  return r.count;
}
