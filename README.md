# SAAF Portal

Participant portal for the **SAAF Project** (Shared Audit Agents Framework) — a co-creative initiative where organisations build AI audit agents together.

**Live:** https://saaf-portal.vercel.app/
**Org:** https://github.com/SAAF-Project

---

## What's in here

A Next.js app that gives SAAF members one place to:

- Sign in with their GitHub account (org-member check)
- View / edit their profile (org, role, track, skills, company logo)
- See the leaderboard, recent activity, and their rank
- Browse all 6 tracks and the plans in each
- Submit observability checks per plan (10-question framework)
- Earn badges (Observability Observer, Contributor, Plan Author, Plan Improver, Implementer)
- See other participants and filter by skill / role / track / organisation
- See their own repos in the SAAF-Project org
- Read SAAF mission, hackathon timeline, and how to contribute
- Browse the agent library (manually curated subset of org repos)
- Find recommended external e-learning resources (Anthropic, ccforeveryone, ForHumanity)
- Send feedback via floating button (DB-stored, admin reviews)
- Request access if they're not yet an org member

Admins (currently just `MSACC`) get a `/admin` page with signup requests + feedback to triage.

---

## Tech

- **Framework:** Next.js 16 (App Router, TypeScript)
- **Auth:** NextAuth.js 4 with GitHub OAuth
- **Database:** Vercel Postgres (Neon) via Prisma 7 with `@prisma/adapter-pg`
- **Styling:** Tailwind v4 (CSS-based config, dark SAAF theme)
- **Markdown:** react-markdown + remark-gfm for plan rendering
- **Deployment:** Vercel (auto-deploy from `main`)

---

## Local development

### Prerequisites

- Node 20+
- Docker (for local Postgres) OR a Neon database
- `gh` CLI authenticated as a SAAF-Project org admin (for `process-signups.ts`)
- A SAAF-Project GitHub OAuth App (Settings → Developer settings → OAuth Apps)
- A GitHub PAT with: Contents/PRs/Issues:Read on all org repos, Members:Read on org

### Setup

```bash
git clone https://github.com/SAAF-Project/saaf-portal.git
cd saaf-portal
npm install

# 1. Start local Postgres
docker run --name saaf-db -e POSTGRES_PASSWORD=saaf -e POSTGRES_DB=saaf -p 5432:5432 -d postgres:16

# 2. Create .env.local (see template below)
cp .env.local.example .env.local
# Edit .env.local with your local DATABASE_URL, OAuth creds, PAT

# 3. Push schema + import seed data
npx prisma db push
npx tsx scripts/import-registrations.ts

# 4. Run
npm run dev
# → http://localhost:3000
```

### `.env.local` template

```bash
DATABASE_URL="postgresql://postgres:saaf@localhost:5432/saaf"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="$(openssl rand -base64 32)"
GITHUB_ID="Ov23li..."           # OAuth App Client ID
GITHUB_SECRET="..."             # OAuth App Client Secret
GITHUB_PAT="github_pat_..."     # Server PAT
```

### `.env.production.local` (gitignored, for `--prod` scripts)

```bash
PROD_DATABASE_URL="postgresql://neondb_owner:...@ep-...neon.tech/neondb?sslmode=require"
```

---

## Scripts

All scripts default to local DB, use `--prod` to target production.

| Script | Purpose |
|---|---|
| `import-registrations.ts` | Read GitHub issues with label `register` from SAAF-Project repo and upsert into `User` table. Creates placeholders with negative `githubId` for invalid usernames. |
| `process-signups.ts` | Interactively walk through pending `SignupRequest` rows. Per request: approve (sends org invite via `gh api`) / deny / skip. Uses your local `gh` CLI auth so no `admin:org` PAT lives in prod. |
| `backup-db.ts` | Dump all tables to `backups/saaf-portal_<env>_<ts>.json`. Directory gitignored. |
| `fix-logo-matches.ts` | Re-run logo matching against all users with current logic. Use after changing `src/lib/logo-match.ts`. |
| `insert-placeholders.ts` | Insert placeholder users via raw SQL (bypasses Prisma cache issues). |
| `add-column.ts` | Add a column via raw SQL — workaround when `prisma db push` reports already-in-sync but the column is missing. |
| `check-db.ts` | Quick health check. |

Examples:

```bash
npx tsx scripts/backup-db.ts --prod
npx tsx scripts/process-signups.ts --prod
npx tsx scripts/import-registrations.ts --prod
```

---

## Architecture notes

### Auth flow

1. User clicks "Sign in with GitHub" → NextAuth → GitHub OAuth
2. `signIn` callback in `src/lib/auth.ts` checks org membership via server PAT (`GET /orgs/SAAF-Project/members/{username}`)
3. If member: matched to existing `User` row (or created), session established
4. If non-member: redirected to `/login?error=not-member` with a signup form
5. Signup creates a `SignupRequest` row → admin processes locally via `scripts/process-signups.ts`

### Data sources

- **User profiles, observability checks, feedback, signup requests:** Postgres (Prisma)
- **Leaderboard:** Computed live from GitHub merged PRs, cached 2 min
- **Plans / tracks / submitters:** Static JSON in `public/data/` (mirrors `SAAF-Project/website/data/`)
- **Plan markdown:** Fetched on-demand via `/api/plan-content` (private repo, can't use raw URLs)
- **Company logos:** Word-boundary matched against `saafproject.com/assets/logos/`
- **Agent library:** Allowlist `AGENT_LIBRARY_REVIEWED` in `src/lib/github.ts` + auto-detection of unreviewed repos

### Caching strategy

GitHub API calls go through `githubFetch` which uses Next.js fetch cache (`next: { revalidate: N }`). This is shared across all Vercel instances at the edge — important during hackathons when 30+ users hit the portal simultaneously.

Per-endpoint TTLs in `src/lib/github.ts` `CACHE_TTL`:

| Endpoint | TTL | Rationale |
|---|---|---|
| Repos list | 10 min | Repo list rarely changes |
| README | 1 h | READMEs change infrequently |
| Contributors | 30 min | |
| Closed PRs | 2 min | Leaderboard wants near-real-time |
| PR files | 1 day | Immutable after merge |
| User lookup | 1 day | User IDs are immutable |
| Org membership | 5 min | Quick reflect new joins |
| Search | 5 min | |

Plus a per-user in-memory cache for `fetchUserOrgRepos` (10 min) — slowest endpoint.

### Leaderboard scoring

| Action | Points | Cap per user |
|---|---|---|
| Merged PR | +10 | 5 PRs (= 50pt max) |
| New plan file added | +15 | 3 plans (= 45pt max) |
| Plan file modified | +5 per unique file | No cap |
| Plan claim (claimed_by in metadata) | +5 | 2 claims (= 10pt max) |

Renamed files are not counted. Files outside `plans/**/*.md` get the +10 PR base but no per-file bonus.

### Achievements (5 badges, in `src/lib/achievements.ts`)

| Badge | Trigger | Levels |
|---|---|---|
| Observability Observer | Unique plan-checks submitted | 1 / 6 / 11 / 21 / 36 |
| Contributor | Merged PRs | 1 / 2 / 3 / 4 / 5 |
| Plan Author | New plan files added | 1 / 2 / 3 (capped) |
| Plan Improver | Plan files modified | 1 / 5 / 10 / 25 / 50 |
| Implementer | Claims | 1 / 2 (capped) |

---

## Deployment

Vercel auto-deploys `main` branch. Required env vars in Vercel dashboard:

- `DATABASE_URL` (auto-injected by Vercel Postgres integration)
- `NEXTAUTH_URL` (Vercel deployment URL)
- `NEXTAUTH_SECRET`
- `GITHUB_ID` / `GITHUB_SECRET` (separate OAuth App for production)
- `GITHUB_PAT` (same as local, but PAT must have access to all org repos)

After schema changes: run `npx prisma db push` locally with `PROD_DATABASE_URL` set in `.env.production.local`.

---

## Project structure

```
src/
├── app/
│   ├── (authenticated)/        # Layout + middleware-protected pages
│   │   ├── dashboard/
│   │   ├── profile/
│   │   ├── leaderboard/
│   │   ├── participants/
│   │   ├── tracks/
│   │   ├── my-repos/
│   │   ├── onboarding/
│   │   ├── about/
│   │   ├── e-learning/
│   │   ├── agent-library/
│   │   └── admin/
│   ├── api/
│   │   ├── auth/[...nextauth]/
│   │   ├── profile/
│   │   ├── leaderboard/
│   │   ├── achievements/
│   │   ├── repos/
│   │   ├── observability/
│   │   ├── participants/
│   │   ├── suggestions/
│   │   ├── activity-stats/
│   │   ├── feedback/
│   │   ├── plan-content/       # Proxies private-repo plans via PAT
│   │   ├── agent-library/
│   │   ├── signup/
│   │   └── admin/
│   │       ├── signups/
│   │       └── feedback/
│   ├── login/
│   ├── layout.tsx
│   ├── globals.css             # Tailwind v4 + SAAF theme tokens
│   └── page.tsx                # Redirects to /dashboard
├── components/                 # All UI components
├── lib/
│   ├── prisma.ts               # Lazy getPrisma() with PrismaPg adapter
│   ├── auth.ts                 # NextAuth config + org-member check
│   ├── github.ts               # Cached GitHub API helpers + AGENT_LIBRARY_REVIEWED
│   ├── scoring.ts              # Leaderboard math
│   ├── achievements.ts         # Badge logic
│   ├── plan-match.ts           # Match plans to user (for My Plans)
│   ├── plan-suggestions.ts     # Match plans to user skills/track
│   ├── profile-completeness.ts # % completeness
│   ├── logo-match.ts           # Word-boundary org → logo matching
│   ├── constants.ts            # Track tasks, role/track options
│   └── generated/              # Prisma client output (gitignored)
├── types/
│   └── index.ts
└── middleware.ts               # Route protection
prisma/
└── schema.prisma               # User, SignupRequest, ObservabilityCheck, Feedback
scripts/                        # Local CLI utilities (--prod for production)
skills/                         # Claude Code skills (SKILL.md format)
public/
├── data/                       # plans.json, tracks.json, submitters.json (mirror)
└── saaf-logo-white.png         # SAAF assets
backups/                        # gitignored — db backups
```

---

## Working with this repo via Claude Code

See `CLAUDE.md` for AI-specific guidance — Prisma 7 quirks, build gotchas, and SAAF-specific patterns Claude needs to know about when modifying this code.

---

## License & data

- Code: see repo settings
- User data: stored only in Vercel Postgres. GDPR — users can request deletion via feedback button.
- No real audit evidence is processed by the portal. Plans reference synthetic data only.
