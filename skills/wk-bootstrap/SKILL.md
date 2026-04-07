---
name: bootstrap
description: "Session bootstrap — detect work-kit state and orient the agent at session start."
user-invocable: false
allowed-tools: Bash, Read
---

# Session Bootstrap

Run `work-kit bootstrap` to detect work-kit state.

## If active work exists

- Report current state to the user: slug, phase, step, status
- **If `knowledge` is present in the bootstrap output**, surface it to the agent and the user:
  - `knowledge.lessons` — project-specific learnings from prior sessions
  - `knowledge.conventions` — codified rules this project follows
  - `knowledge.risks` — fragile or dangerous areas to handle with care
  - Read each of these silently into your working context — they're prior knowledge you should respect when planning and building. Briefly mention to the user that prior knowledge was loaded (one line; do not dump the full text into the chat).
  - `workflow.md` is intentionally NOT loaded — it's a write-only artifact for human curators.
- If recovery is suggested: follow the recovery instruction
- Otherwise: run `work-kit next` to continue the workflow

## If no active work

- Inform the user that work-kit is available
- Available commands: `/full-kit <description>` or `/auto-kit <description>`
- Do not start work unprompted

## If session is stale

- Report the staleness warning to the user
- Run `work-kit status` to get full diagnostics
- If the state is recoverable, run `work-kit next` to resume
- If the state is corrupted, suggest starting fresh
