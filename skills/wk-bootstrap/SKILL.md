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
