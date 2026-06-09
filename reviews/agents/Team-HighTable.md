# Agent review — Team-HighTable

- **Verdict:** 🟡 borderline (needs a real README)
- **Reviewed:** 2026-06-09 · Portal agent review (approved by MSACC)
- **Repo:** https://github.com/SAAF-Project/Team-HighTable
- **Category:** Risk & Controls
- **Tags:** AI governance, browser-extension, embeddings, anomaly
- **Language / structure:** Full-stack — Python backend (Claude client + embeddings + API) + Chrome browser extension UI

## Quality criteria

| Criterion | Result |
|---|---|
| Working code + runnable interface | ✓ backend API + Chrome extension |
| Dependency manifest | ✓ backend/requirements.txt |
| Unit tests | ✗ |
| Sample inputs/outputs | ✓ governance workpaper + EU AI Act PDF |
| README | ✗ 1-line placeholder |

## Assessment

Dual-stack agent (backend API + Chrome extension) with Claude integration, embeddings, and a governance workpaper sample. The README is a one-line placeholder, so the project is hard to discover or run.

## Reasoning

Real, multi-component working code with a manifest and a sample, but held back by a placeholder README and no tests.

## Path to reviewed

Add a real README: what the backend and the extension do, and how to install and run both. Optionally add a test.
