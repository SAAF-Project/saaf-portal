# Agent review — WhatsTheNews

- **Verdict:** ✅ reviewed
- **Reviewed:** 2026-06-03 · Portal agent review (approved by MSACC)
- **Repo:** https://github.com/SAAF-Project/WhatsTheNews
- **Category:** Evidence
- **Tags:** Node.js, RSS, news-aggregation, regulatory
- **Language / structure:** JavaScript — single-file Node.js HTTP app (ESM) with a browser form UI and a `node:test` suite

## Quality criteria

| Criterion | Result |
|---|---|
| Working code + runnable interface | ✓ HTTP server + homepage form |
| Dependency manifest | ✓ |
| Unit tests | ✓ 7 (`node:test`) |
| Sample inputs/outputs | ✗ (fixtures inline in tests) |

## Assessment

Dependency-free Node app that fetches and categorises DNB/AFM/FD regulatory news into a weekly HTML briefing, with a browser form UI and 7 `node:test` unit tests covering parsing, categorisation, and reporting.

## Reasoning

Clears the bar: a real, runnable app (not a plan/README) with a clear interface, exported testable functions, and a 7-test suite using Node's built-in runner. Functionally exceeds thinner reviewed entries. The only minor gap — no dedicated samples directory (fixtures are inline) — does not block `reviewed`.
