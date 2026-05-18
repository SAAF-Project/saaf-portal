---
name: pr-review
description: Review a GitHub pull request. Use when asked to review a PR, evaluate code changes, check merge-readiness, or give feedback on a pull request on any GitHub repo. Invoke with a PR number and repo (e.g. "review PR #42 on SAAF-Project/SAAF-Project") or a PR URL.
---

# PR Review

## When to use

Invoke this skill when the user asks to:
- Review a pull request
- Check if a PR is ready to merge
- Give feedback on code changes
- Assess a PR for quality, security, or compliance

## How to run a review

### Step 1 — Gather metadata

```bash
gh pr view <number> --repo <owner/repo> \
  --json number,title,author,body,additions,deletions,files,createdAt,labels,reviewRequests
```

### Step 2 — Get the diff

```bash
gh pr diff <number> --repo <owner/repo>
```

For large diffs, focus on the most critical files first. Look at:
- Files with the most additions/deletions
- New files (especially scripts, configs, auth-related)
- Test files (or the absence of them)

### Step 3 — Check CI status

```bash
gh pr checks <number> --repo <owner/repo>
```

### Step 4 — Review against this checklist

**Scope & intent**
- [ ] Does the PR description clearly explain what and why?
- [ ] Is the PR focused on one thing, or is it mixing unrelated changes?
- [ ] Are there any files changed that seem unrelated to the stated purpose?

**Code quality**
- [ ] Is the logic correct? Look for off-by-one errors, race conditions, null pointer risks.
- [ ] Are there hardcoded values that should be configurable?
- [ ] Is error handling present for failure cases (API calls, file I/O, missing env vars)?
- [ ] Are there TODO/FIXME left in the code?

**Security**
- [ ] Are credentials, API keys, or secrets committed? (Check `.env`, hardcoded strings)
- [ ] Is user input sanitised before use?
- [ ] Does new code respect existing access controls?
- [ ] Are there new dependencies? Check for supply-chain risk.

**Tests**
- [ ] Does the PR include tests for new behaviour?
- [ ] Do existing tests still pass?
- [ ] If no tests: is this acceptable given the nature of the change?

**Documentation**
- [ ] Is a README update needed?
- [ ] Are new scripts/commands documented?
- [ ] Are breaking changes called out?

**Breaking changes**
- [ ] Could this PR break existing users or downstream integrations?
- [ ] Is there a migration path?

### Step 5 — Produce the review report

Structure the output as:

```
## PR #<number> — <title>

**Author:** @<login> | **Files:** <n> | **+<additions>/-<deletions>**

### ✅ Good
[List positives — what is done well]

### ⚠ Concerns (non-blocking)
[List things worth improving but not blocking merge]

### ❌ Blockers
[List things that MUST be fixed before merge]

### Leaderboard / scoring impact (if applicable)
[Point value this PR will earn for the author, if repo tracks contributions]

### Recommendation
**Approve** / **Approve with minor comments** / **Request changes** / **Questions before merge**
```

## Tips

- Be specific: quote the line or function you're commenting on.
- Separate style preferences from real issues.
- If a concern is minor, say so explicitly — don't let it block a good PR.
- If you can't fully assess something (e.g. runtime behaviour, external service), say so.
