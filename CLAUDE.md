# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

SAAF Portal — participant portal for the SAAF Project (Shared Audit Agents Framework). Members of the SAAF-Project GitHub organization log in via GitHub OAuth to view their profile, leaderboard, tracks, repos, and onboarding guide. Non-members can request access via a signup form; requests are processed by the admin locally via CLI.

Deployed on Vercel at https://saaf-portal.vercel.app/. The portal button lives on saafproject.com (separate `SAAF-Project/website` repo).

## Commands

```bash
npm run dev          # Start dev server (localhost:3000)
npm run build        # prisma generate + next build
npm run lint         # ESLint
npx prisma generate  # Regenerate Prisma client after schema changes
npx prisma db push   # Push schema to database (no migrations)

# Scripts (run from project root)
npx tsx scripts/import-registrations.ts          # Import 85 registration issues → local DB
npx tsx scripts/import-registrations.ts --prod   # Same but against production DB
npx tsx scripts/process-signups.ts --prod        # Process pending signup requests (production)
```

## Architecture

**Stack:** Next.js 16 (App Router) · NextAuth.js 4 (GitHub OAuth) · Prisma 7 (`@prisma/adapter-pg`) · Vercel Postgres (Neon) · Tailwind v4

### Prisma 7 specifics

- Generator is `prisma-client` (not `prisma-client-js`) with output `../src/generated/prisma`
- Connection URL lives in `prisma.config.ts`, not in `schema.prisma`
- `PrismaClient` requires an adapter: `new PrismaClient({ adapter: new PrismaPg({...}) })`
- Client is lazy-loaded via `getPrisma()` in `src/lib/prisma.ts` — the build must succeed without `DATABASE_URL`
- Import from `@/generated/prisma/client`, not from `@prisma/client`

### Tailwind v4

Uses CSS-based config with `@theme inline` in `globals.css` — no `tailwind.config.ts`. SAAF color tokens are defined as `--color-*` CSS variables (bg, surface, accent, saaf-green, saaf-yellow, etc.).

### Auth flow

1. GitHub OAuth via NextAuth → `signIn` callback checks org membership using server-side `GITHUB_PAT`
2. Non-members get redirected to `/login?error=not-member&username=...` → signup form
3. Signup requests stored in `SignupRequest` table → admin processes via CLI script (no `admin:org` PAT in prod)
4. Middleware protects all `/(authenticated)/` routes

### Data sources

- **User profiles:** Postgres (Prisma)
- **Leaderboard + activity:** Computed live from GitHub API (merged PRs), cached 60s in-memory. Scoring logic in `src/lib/scoring.ts`, ported from the hackathon website.
- **Plans + tracks:** Static JSON files in `public/data/` (copied from `SAAF-Project/SAAF-Project/website/data/`)
- **Company logos:** Auto-matched from organisation name via `src/lib/logo-match.ts` against logos hosted on saafproject.com

### Admin

Admin page at `/admin` is restricted to GitHub username `MSACC` (hardcoded in `Navbar.tsx` and `api/admin/signups/route.ts`).

### Dual repo setup

Source of truth is this repo (`SAAF-Project/saaf-portal`), deployed via Vercel. A copy also exists in `SAAF-Project/SAAF-Project/public-harness-website/` — keep them in sync when making changes.

## Environment variables

Required in `.env.local` for local dev:

```
DATABASE_URL, NEXTAUTH_URL, NEXTAUTH_SECRET, GITHUB_ID, GITHUB_SECRET, GITHUB_PAT
```

For `--prod` scripts, set `PROD_DATABASE_URL` in `.env.production.local` (gitignored).
