# Agent review — Track-2---IAM-final

- **Verdict:** ✅ reviewed
- **Reviewed:** 2026-06-03 · Portal agent review (approved by MSACC)
- **Repo:** https://github.com/SAAF-Project/Track-2---IAM-final
- **Category:** AI Security
- **Tags:** IAM, Access Review, ISO27001, SOC2
- **Language / structure:** Python — Streamlit app + standalone CLI + FastAPI web app (`bart/` sub-package); also the Track 2 hub repo

## Quality criteria

| Criterion | Result |
|---|---|
| Working code + runnable interface | ✓ Streamlit + CLI + FastAPI |
| Dependency manifest | ✓ |
| Unit tests | ✓ 9 (pytest) |
| Sample inputs/outputs | ✓ sample CSV/JSON + finding schema |

## Assessment

IAM access-review agent cross-referencing AD vs HR exports into Claude-generated findings; ships a Streamlit app plus a polished CLI/FastAPI sub-package with 9 pytest tests, sample CSV/JSON data, a finding schema, and ISO 27001 / SOC 2 / ISAE 3402 control mappings.

## Reasoning

Comfortably clears the bar: real runnable agent code with multiple interfaces, 9 unit tests, sample inputs and outputs, dependency manifests, and an output JSON schema. The `bart/` sub-package adds anonymisation, schema validation, and regulatory control references. The repo also serves as the broad Track 2 hub (many plans/docs), but the actual agent implementation is substantive and well-structured.
