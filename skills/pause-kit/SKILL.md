---
name: pause-kit
description: "Pause the active work-kit session. Use when stepping away mid-flight. Usage: /pause-kit [reason]"
user-invocable: true
argument-hint: "[reason]"
allowed-tools: Bash, Read
---

You are pausing the active work-kit session so it can be resumed cleanly later.

## Steps

1. Run `work-kit bootstrap` to confirm a session is active. If no session is active, tell the user there is nothing to pause and stop.
2. `cd` into the worktree path reported by bootstrap.
3. Run:
   ```bash
   work-kit pause${ARGUMENTS:+ --reason "$ARGUMENTS"}
   ```
4. Parse the JSON response.
5. Report the message to the user. Tell them they can run `/resume-kit` (or `work-kit resume`) when ready.

## Notes

- Pausing only flips state to `paused` and records `pausedAt` — no files are deleted, no git operations happen.
- The orchestrator (`/full-kit`, `/auto-kit`) refuses to advance a paused session until it is resumed.
