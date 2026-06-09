# Agent review — threewaysecurity

- **Verdict:** 🟡 borderline (one step from reviewed)
- **Reviewed:** 2026-06-09 · Portal agent review (approved by MSACC)
- **Repo:** https://github.com/SAAF-Project/threewaysecurity
- **Category:** Audit Reporting
- **Tags:** procurement, 3-way-match, multi-agent, fraud-detection
- **Language / structure:** Python — multi-agent pipeline (run_pipeline.py + demo_pipeline.py + src/agent, generators, evaluator)

## Quality criteria

| Criterion | Result |
|---|---|
| Working code + runnable interface | ✓ two entry points (full pipeline + demo) |
| Dependency manifest | ✓ requirements.txt |
| Unit tests | ✗ |
| Sample inputs/outputs | ✓ extensive synthetic dataset (~23 files incl. ground-truth labels) |
| README | ✗ missing |

## Assessment

Sophisticated multi-agent procurement (3-way match + fraud) auditor with two runnable entry points and an extensive committed synthetic dataset, plus a manifest. The domain and how to run it currently live only in code docstrings and a PowerPoint.

## Reasoning

Strong borderline: runnable pipeline + manifest + excellent committed samples clears the bar except for documentation — there is no README, so nothing is discoverable from the repo root.

## Path to reviewed

Add a real README: what it does, the agent architecture, how to run `run_pipeline.py` vs `demo_pipeline.py`, and what synthetic data is included. That single step would take this to reviewed.
