---
name: resume-kit
description: "Resume a paused work-kit session and continue where it left off. Usage: /resume-kit"
user-invocable: true
allowed-tools: Bash, Read, Agent, Write, Edit, Glob, Grep
---

You are resuming a paused work-kit session.

## Steps

1. Run `work-kit bootstrap` to find the active session. If `active: false`, tell the user there is no session and stop.
2. `cd` into the worktree path reported by bootstrap.
3. Run:
   ```bash
   work-kit resume
   ```
4. Parse the JSON. If `action: "resumed"`, report the slug, phase, and step to the user.
5. Continue the orchestrator loop (same as `/full-kit` / `/auto-kit`):
   ```bash
   work-kit next
   ```
   Then follow the action returned (`spawn_agent`, `spawn_parallel_agents`, `wait_for_user`, etc.) using the Agent tool.

## Notes

- `resume` is idempotent: if the session was already in-progress, it just reports the current location.
- A paused session keeps all state — phases, steps, loopbacks, timing — exactly as they were.
