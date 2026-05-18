# SAAF Leaderboard Scoring Rules

Source of truth: `src/lib/scoring.ts` in the `saaf-portal` repo.
The leaderboard lives at https://saaf-portal.vercel.app/leaderboard

## Scoring table

| Action | Points | Cap per user | Notes |
|---|---|---|---|
| Merged PR | +10 | 5 PRs (50pt max) | Any PR merged to SAAF-Project/SAAF-Project |
| New plan file added | +15 | 3 plans (45pt max) | File in `plans/**/*.md`, status=`added` |
| Plan file modified | +5 | None | File in `plans/**/*.md`, status=`modified`, unique filename |
| Claim set | +5 | 2 claims (10pt max) | `Claimed By` field set in plan metadata |

**Base maximum: 105pt** (before uncapped plan updates)

## Edge cases and gotchas

- **`renamed` status → 0pt.** If a plan is renamed (moved), it earns nothing regardless of content changes. The scoring code only handles `added` and `modified`.
- **Plan updates have no cap.** A single PR that modifies 12 plan files earns 60pt from updates alone. This is intentional but can be gamed.
- **Files outside `plans/` → 0pt bonus.** Prompts, scripts, tools, docs, outputs — all earn 0pt per file. Only the +10pt PR base applies.
- **The "cap" applies to the first N found in API iteration order** (newest PR first). So your 5 most recently merged PRs count toward the PR cap.
- **Co-authored PRs** — only the PR opener (the author who created it on GitHub) gets points. `Co-Authored-By` trailers in commit messages are not parsed.
- **Bot accounts** — not excluded by the scoring logic. If a bot opens a PR, it appears in the leaderboard.

## Time filters

The leaderboard supports three views:

| Filter | Since |
|---|---|
| All time | Beginning of repo |
| Since Hackathon #3 | 2026-04-21 |
| Since Hackathon #2 | 2026-03-24 |

Filters apply to `merged_at` date of the PR.

## How to calculate PR impact manually

1. Get PR files: `gh pr view <num> --repo SAAF-Project/SAAF-Project --json files`
2. Count files where `path` starts with `plans/` and ends with `.md`:
   - `changeType=ADDED` → each earns +15pt (up to user's remaining plan cap)
   - `changeType=MODIFIED` → each earns +5pt (no cap)
   - `changeType=RENAMED` → 0pt
3. Add +10pt for the PR itself (if under cap)
4. Check if any modified plan has `Claimed By` set → +5pt per claim (up to 2)
