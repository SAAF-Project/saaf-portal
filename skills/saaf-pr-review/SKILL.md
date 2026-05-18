---
name: saaf-pr-review
description: Review a pull request on the SAAF-Project organisation. Use when reviewing PRs on SAAF-Project/SAAF-Project or any other SAAF-Project repo. Extends standard PR review with SAAF-specific checks: plan template compliance, leaderboard impact calculation, and SAAF agent guardrails verification.
---

# SAAF PR Review

## When to use

Use this skill for PRs on any `SAAF-Project/*` repository. It runs all standard PR review checks (see `pr-review` skill) **plus** SAAF-specific checks defined below.

## How to run

### Step 1 — Run standard review

Follow the full `pr-review` skill workflow (gather metadata, diff, CI checks, quality checklist).

### Step 2 — SAAF-specific checks

#### A. Plan template compliance

For any file matching `plans/**/*.md` that is **added** or **modified**, check:

1. **Section 1 (Metadata table)** present with at minimum:
   - `Submitter`, `Organisation`, `Session`, `Type`, `Status`
   - Optional but expected: `Claimed By` (can be blank)

2. **Section 2 (Problem Statement)** — non-empty, describes the audit problem being solved

3. **Section 3 (Use-Case Type and Scope)** — In scope / Out of scope defined

4. **Section 11 (PDCA table)** — must be present; check each phase is one of:
   `Not started` / `In progress` / `Complete`

5. **File name convention** — `firstname-lastname-slug.md` in `plans/hackathon-X/` (lowercase, hyphens)

See `references/plan-template-check.md` for the full required structure.

#### B. Leaderboard impact

Calculate what this PR will earn for its author once merged. See `references/leaderboard-scoring.md` for full rules.

**Quick calculator:**

```
Files changed — count each category:
  plans/*.md  status=added    → +15pt each (max 3 new plans = 45pt)
  plans/*.md  status=modified → +5pt each unique file (no cap)
  plans/*.md  status=renamed  → 0pt (renames not counted)
  PR itself (any merged PR)   → +10pt (max 5 PRs = 50pt)

Claim check:
  If any plan file has `Claimed By` set to a name → +5pt (max 2 claims)

Total = PR base + new plan bonus + update bonus + claim bonus
```

Include the calculation in your review report.

#### C. SAAF agent guardrails

For any **script** files (`tools/scripts/*.py`, `*.sh`, etc.) or **tool configurations** in the PR:

- [ ] No `rm`, `sudo`, `curl`, `wget`, `ssh`, `scp`, `chmod`, `chown` commands
- [ ] No `pip install` at runtime (dependencies go in `requirements.txt` only)
- [ ] No hardcoded API keys or credentials — must load from `.env` or environment
- [ ] Python scripts run only from `tools/scripts/` (not arbitrary paths)
- [ ] No outbound network requests except through approved API connectors (Anthropic API, approved MCP servers)

See `references/saaf-guardrails.md` for the complete allowlist.

#### D. Output files

- Files in `outputs/` should be **example/synthetic** data only — never real audit evidence
- Generated output files (e.g. `work_program.json`, `work_program.md`) should not be committed unless they are example files for tryout
- No personal data, client names, or confidential findings

#### E. Prompt files

For files in `prompts/`:
- [ ] Has metadata header (use case, applicable standards, intended AI tool)
- [ ] Has system context block
- [ ] Has user prompt template with `[placeholder]` syntax
- [ ] Has notes on limitations

### Step 3 — Enhanced review report

Add an **SAAF** section to the standard review report:

```
### SAAF-specific checks

**Plan template compliance**
- [ ] Section 1 (Metadata) ✓/✗
- [ ] Section 2 (Problem Statement) ✓/✗
- [ ] Section 11 (PDCA table) ✓/✗
- [ ] File naming convention ✓/✗

**Leaderboard impact for @<author>**
- PR base: +10pt (cap: check if user already has 5 merged PRs)
- New plans: <n> × +15pt = <total>pt
- Plan updates: <n> × +5pt = <total>pt
- Claims: <n> × +5pt = <total>pt
- **Estimated total this PR: <X>pt**

**Agent guardrails** (if scripts present)
- [ ] No prohibited commands ✓/✗
- [ ] No runtime pip install ✓/✗
- [ ] No hardcoded credentials ✓/✗
- [ ] Synthetic data only ✓/✗
```

## References

Load on demand to save context:

- `references/plan-template-check.md` — full plan template structure and required fields
- `references/leaderboard-scoring.md` — scoring rules, caps, and edge cases
- `references/saaf-guardrails.md` — allowed and prohibited commands
