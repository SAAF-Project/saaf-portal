# Agent reviews

Human-readable audit log of agent-repo quality reviews for the SAAF agent library.

- **Machine-readable registry:** [`public/data/agent-reviews.json`](../public/data/agent-reviews.json) — the portal reads records with `verdict: "reviewed"` to drive both the agent-library **reviewed** badge and the leaderboard **Agent Builder** bonus.
- **Per-agent analysis:** `reviews/agents/<repo>.md` — the full reasoning behind each verdict, so reviews are versioned, reusable, and survive session boundaries (e.g. for the `saaf-pr-review` skill).

## Verdicts

| Verdict | Meaning | Leaderboard effect |
|---|---|---|
| `reviewed` | Real, working agent that meets the quality bar (working code, clear interface, ideally tests + samples) | Reviewed bonus (+20 per repo, best 2) |
| `borderline` | Functional but thin — usually missing tests **and** samples | Base bonus only (+8) if it passes the code gate |
| `not-yet` | Stub / plan-only / no working code | No reviewed metadata; earns base bonus only if it clears the code gate |

## The bar (what "reviewed" requires)

A reviewed agent is a real, runnable agent — not a plan or README. It should have:

1. **Working code** with a clear runnable interface (CLI, Streamlit, Flask, FastAPI, …).
2. **Dependency manifest** (`requirements.txt` / `pyproject.toml` / `package.json` / …).
3. Ideally **unit tests** and **sample inputs/outputs**.

No-test agents can still be reviewed if they ship samples + a polished interface (precedent: `CUEC_Crosscheck`, `llm_owasp`).

## How to promote an agent

1. Review the repo and write `reviews/agents/<repo>.md`.
2. Add/flip its record to `verdict: "reviewed"` in `public/data/agent-reviews.json` with `category`, `tags`, and `quality` flags.
3. Deploy — the badge and leaderboard bonus update automatically.
