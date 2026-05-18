# SAAF Agent Guardrails — Allowed Commands

Source: `regulatory/guardrails/allowed-commands.md` in `SAAF-Project/SAAF-Project`.

## Core principles

- **Allowlist only** — deny everything not explicitly listed
- **Read before write** — prefer read-only; require approval for writes
- **No network egress from scripts** — only through approved API connectors
- **No privilege escalation** — never `sudo`, `su`, or equivalent

## Permitted in scripts

```
# Read-only filesystem
ls, cat, head, tail, wc, find, stat

# Write (with approval)
cp, mkdir, mv

# Data processing
python, python3, jq, csv (via Python)

# Git (read-only)
git status, git log, git diff, git show
```

Python scripts must run only from `tools/scripts/` — not arbitrary paths.

## Explicitly prohibited

```
rm              # deletion (use cp + manual review instead)
sudo / su       # privilege escalation
curl / wget     # arbitrary outbound HTTP
ssh / scp       # remote access
chmod / chown   # permission changes
cron            # scheduled tasks
pip install     # runtime package installation (use requirements.txt)
```

## What to check in a PR

When reviewing scripts or tool configs:

1. **No prohibited commands** — grep the diff for `rm `, `sudo`, `curl`, `wget`, `ssh`
2. **No runtime pip install** — look for `subprocess.run(["pip", ...])` or `os.system("pip...")`
3. **No hardcoded credentials** — API keys should load from `.env` or env vars, not be in source
4. **No arbitrary network requests** — only Anthropic API (`api.anthropic.com`) and explicitly approved MCP endpoints
5. **Python scripts only from tools/scripts/** — no `exec()`, no dynamic path construction for script loading
6. **No real audit evidence** — `outputs/` should contain only synthetic/example data

## Approved API connectors

- Anthropic Claude API (`api.anthropic.com`)
- Jira / Confluence MCP server (when explicitly configured by team)
- Approved synthetic data endpoints
