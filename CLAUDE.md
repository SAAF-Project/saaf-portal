# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

SAAF Portal — participant portal for the SAAF Project (Shared Audit Agents Framework). Members of the SAAF-Project GitHub organization log in via GitHub OAuth to view their profile, leaderboard, tracks, repos, achievements, and onboarding. Non-members can request access via a signup form; requests are processed by the admin locally via CLI.

Deployed on Vercel at https://saaf-portal.vercel.app/. The portal button lives on saafproject.com (separate `SAAF-Project/website` repo).

**This is the only source of truth.** The old `SAAF-Project/SAAF-Project/public-harness-website/` directory has been removed from tracking — it is gitignored in the SAAF-Project repo.

## Commands

```bash
npm run dev          # Start dev server (localhost:3000)
npm run build        # prisma generate + next build
npm run lint         # ESLint
npx prisma generate  # Regenerate Prisma client after schema changes
npx prisma db push   # Push schema (uses prisma.config.ts → PROD_DATABASE_URL or DATABASE_URL)

# Scripts — run from project root. All scripts support --prod flag for production DB.
npx tsx scripts/import-registrations.ts --prod   # Import GitHub issues with label "register" → User table
npx tsx scripts/process-signups.ts --prod        # Interactively approve signup requests + send org invites via gh CLI
npx tsx scripts/backup-db.ts --prod              # Dump all tables to backups/saaf-portal_prod_<ts>.json (gitignored)
npx tsx scripts/fix-logo-matches.ts --prod       # Re-run logo matching against all users with current logic
npx tsx scripts/insert-placeholders.ts           # Insert placeholder users via raw SQL (negative githubId)
npx tsx scripts/add-column.ts                    # Add a column via raw SQL (bypass Prisma cache)
npx tsx scripts/check-db.ts                      # Quick DB health check
```

## Architecture

**Stack:** Next.js 16 (App Router) · NextAuth.js 4 (GitHub OAuth) · Prisma 7 (`@prisma/adapter-pg`) · Vercel Postgres (Neon) · Tailwind v4 · react-markdown

### Prisma 7 quirks (important!)

- Generator is `prisma-client` (not `prisma-client-js`) with output `../src/generated/prisma`
- Connection URL lives in `prisma.config.ts`, **not** in `schema.prisma`
- `PrismaClient` requires an adapter: `new PrismaClient({ adapter: new PrismaPg({ connectionString }) })`
- Client is lazy-loaded via `getPrisma()` in `src/lib/prisma.ts` — the build must succeed without `DATABASE_URL`
- Import from `@/generated/prisma/client`, **not** from `@prisma/client`
- When `prisma db push` claims "already in sync" but a column is missing: it's the Prisma client cache. Use `scripts/add-column.ts` with raw SQL as a fallback.
- Scripts use native `pg` Client (not Prisma) for things that bypass Prisma's schema cache.

### Tailwind v4

Uses CSS-based config with `@theme inline` in `globals.css` — no `tailwind.config.ts`. SAAF color tokens are defined as `--color-*` CSS variables:
- `bg`, `surface`, `surface2`, `border`, `text`, `muted`
- `accent`, `accent-hover`, `indigo-600`, `indigo-700`
- `saaf-green`, `saaf-yellow`, `saaf-red`, `saaf-purple`, `saaf-orange`

### Auth flow

1. GitHub OAuth via NextAuth → `signIn` callback checks org membership using server-side `GITHUB_PAT`
2. Non-members get redirected to `/login?error=not-member&username=...` → signup form
3. Signup requests stored in `SignupRequest` table → admin processes via CLI script (no `admin:org` PAT in prod for safety)
4. Middleware (`src/middleware.ts`) protects all `/(authenticated)/` routes

### Data sources

- **User profiles + observability checks + feedback + signup requests:** Postgres (Prisma)
- **Leaderboard + activity:** Computed live from GitHub API (merged PRs). Scoring logic in `src/lib/scoring.ts`.
- **Plans + tracks + submitters:** Static JSON in `public/data/` (mirrors `SAAF-Project/website/data/`)
- **Plan markdown content:** Fetched on-demand via `/api/plan-content` (proxies GitHub API with PAT — needed because SAAF-Project repo is private so raw.githubusercontent.com URLs don't work)
- **Company logos:** Word-boundary matched from organisation name via `src/lib/logo-match.ts` against logos hosted on saafproject.com
- **Agent library:** Allowlist in `src/lib/github.ts` (`AGENT_LIBRARY_REVIEWED`) — manually curated subset of org repos with quality metadata. Other org repos shown with auto-detected status (work-in-progress / needs-readme / not-reviewed).

### GitHub API caching layers

All `githubFetch` calls accept a `revalidate` option that maps to Next.js fetch cache (CDN-shared across instances). TTLs defined in `CACHE_TTL` in `src/lib/github.ts`:

- `REPOS_LIST`: 600s (10min) — repo list rarely changes
- `README`: 3600s (1h) — READMEs change infrequently
- `CONTRIBUTORS`: 1800s (30min)
- `PRS_CLOSED`: 120s (2min) — leaderboard needs near-real-time
- `PR_FILES`: 86400s (1 day) — immutable after merge
- `USER_LOOKUP`: 86400s (1 day) — user IDs are immutable
- `ORG_MEMBER`: 300s (5min)
- `SEARCH`: 300s (5min)

Plus per-user in-memory cache in `fetchUserOrgRepos` (10min) — the slowest endpoint due to N+1 contributor checks.

### Admin

Admin page at `/admin` is restricted to GitHub username `MSACC` (hardcoded in `Navbar.tsx`, `api/admin/signups/route.ts`, `api/admin/feedback/route.ts`). Admin page has 2 tabs: Signup Requests + Feedback.

### Placeholder users

Users with `githubId < 0` are placeholders — registered via the GitHub issues but didn't provide a valid GitHub username. They appear on `/participants` with "No GitHub account linked" label and a "?" avatar. They cannot log in. ID is `-(issue.number)`.

## Environment variables

Required in `.env.local` for local dev:

```
DATABASE_URL          # Local Postgres (Docker: postgresql://postgres:saaf@localhost:5432/saaf)
NEXTAUTH_URL          # http://localhost:3000
NEXTAUTH_SECRET       # openssl rand -base64 32
GITHUB_ID             # OAuth App Client ID
GITHUB_SECRET         # OAuth App Client Secret
GITHUB_PAT            # Fine-grained PAT, All repos in SAAF-Project org, scopes: Contents:Read, PRs:Read, Issues:Read, Members:Read
```

For `--prod` scripts, set `PROD_DATABASE_URL` in `.env.production.local` (gitignored).

`prisma.config.ts` loads `.env.production.local` first then `.env.local` — and prefers `PROD_DATABASE_URL` over `DATABASE_URL`. So `npx prisma db push` runs against prod by default if `PROD_DATABASE_URL` is set.

## Backups

`scripts/backup-db.ts --prod` dumps all tables to `backups/saaf-portal_prod_<timestamp>.json` (~40KB). The `/backups/` directory is gitignored. Neon free tier gives 24h point-in-time recovery — backups extend that horizon.

## Skills

The `skills/` directory contains Claude Code skill definitions following the standard SKILL.md format (YAML frontmatter + markdown body). Discoverable via the docus.dev / Cloudflare Agent Skills RFC pattern.

- `skills/pr-review/SKILL.md` — generic GitHub PR review
- `skills/saaf-pr-review/SKILL.md` — SAAF-specific PR review (plan template, leaderboard impact, guardrails)

## Leaderboard scoring rules (for reference)

Implemented in `src/lib/scoring.ts`. Per user, against `SAAF-Project/SAAF-Project` PRs:

| Action | Points | Cap |
|---|---|---|
| Merged PR | +10 | 5 PRs |
| New plan file (`plans/*.md` status=added) | +15 | 3 plans |
| Modified plan file (status=modified, unique filename) | +5 | None |
| Plan claim (`claimed_by` set in metadata) | +5 | 2 claims |

**Gotchas:**
- `renamed` status is ignored entirely (0pt).
- Plan updates have no cap — theoretically unbounded.
- A PR with files only in `prompts/`, `tools/`, etc. earns only the +10pt PR base — no bonus per file.
- The "first 5 PRs" cap applies in iteration order of `Object.entries(prCache)`, which is GitHub API order = newest first.
