# SAAF Plan Template Compliance Checklist

Template source: `docs/plans/plan-template.md` in `SAAF-Project/SAAF-Project`.

## Required sections (minimum for a valid plan)

### Section 1 — Metadata table

Must be a Markdown table at the top of the file with at minimum:

| Field | Required | Notes |
|---|---|---|
| Submitter | Yes | Full name (pseudonym allowed) |
| Organisation | Yes | Org or "Anonymous" |
| Session | Yes | e.g. "Hackathon 4 (Session 5)" |
| Type | Yes | Agent / Skill / Workflow |
| Status | Yes | Draft / Presented / Finalised |
| Claimed By | No | Name if actively building; blank if proposing only |

### Section 2 — Problem Statement

- Non-empty paragraph(s) describing the audit problem being solved
- Should answer: why is this manual work today? What is the cost/risk?

### Section 3 — Use-Case Type and Scope

Must contain at minimum:
- **In scope:** bulleted list of what the agent handles
- **Out of scope:** what the agent explicitly does not do

### Section 11 — PDCA table

Required. Each phase must have one of: `Not started` / `In progress` / `Complete`

```markdown
| Phase | Status |
|---|---|
| Plan | Not started |
| Do | Not started |
| Check | Not started |
| Act | Not started |
```

## File naming convention

Pattern: `firstname-lastname-slug.md`
- All lowercase
- Words separated by hyphens
- No spaces or underscores
- Example: `inge-garretsen-audit-work-program-agent.md`

Must be placed in: `plans/hackathon-X/` (e.g. `plans/hackathon-4/`)

## Common issues to flag

- Metadata table missing `Type` or `Status` field
- `Status` still says `Draft` for a Hackathon session (should be `Presented` after the event)
- Section 11 missing entirely
- File placed in wrong directory (e.g. `plans/` root instead of `plans/hackathon-4/`)
- Template comments (`<!-- ... -->`) not removed before PR
- Section title `# Plan Template — SAAF Hackathon Submission` not replaced with actual plan title
