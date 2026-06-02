# Agent review — Policy-to-Controls-Extractor

- **Verdict:** 🟡 borderline
- **Reviewed:** 2026-06-03 · Portal agent review (approved by MSACC)
- **Repo:** https://github.com/SAAF-Project/Policy-to-Controls-Extractor
- **Category:** Compliance
- **Tags:** compliance, controls, policy-extraction, anthropic
- **Language / structure:** Python — multi-module package + CLI (agent orchestrator, models/prompts, `services/` extractors)

## Quality criteria

| Criterion | Result |
|---|---|
| Working code + runnable interface | ✓ CLI + Critic pass |
| Dependency manifest | ✓ |
| Unit tests | ✗ |
| Sample inputs/outputs | ✗ (`testdata/` is gitignored) |

## Assessment

Clean multi-module Python CLI agent that extracts 6W-framework controls from PDF/DOCX policies via Claude with a Critic pass and JSON/XLSX output, but ships no tests, no committed sample fixtures, and a stray `docx_extractor copy.py` duplicate.

## Reasoning

Genuine, runnable multi-file agent — structurally stronger than some reviewed single-file MVPs — but hits the borderline condition of having neither unit tests nor committed sample inputs/outputs, plus a leftover duplicate file.

## Path to reviewed

Add a couple of unit tests, commit sample policy/output fixtures, and remove the `docx_extractor copy.py` duplicate.
