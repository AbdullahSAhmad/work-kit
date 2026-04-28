---
name: resume-kit
description: "Resume a paused or abandoned work-kit session and continue where it left off. Usage: /resume-kit"
user-invocable: true
allowed-tools: Bash, Read, Agent, Write, Edit, Glob, Grep
---

You are resuming a work-kit session. The user typically runs Claude Code from the **main repo root**, not from inside a worktree, so you must discover resumable sessions across all worktrees of the current repo and let the user pick one. Both `paused` and `in-progress` sessions are listed, since a crashed terminal leaves state as `in-progress`.

## Steps

1. From the main repo root, run:
   ```bash
   work-kit resume
   ```
   This scans every worktree of the current git repo for `.work-kit/tracker.json` files in `paused` or `in-progress` state and returns one of:

   - `action: "error"` — no resumable sessions in this repo. Tell the user and stop.
   - `action: "select_session"` — one or more sessions found. The `sessions` array is sorted by most-recently-updated first and contains entries like:
     ```json
     {
       "slug": "item-count-badge",
       "branch": "feat/item-count-badge",
       "worktreeRoot": "/abs/path/to/worktree",
       "status": "paused",
       "pausedAt": "2026-04-06T18:42:11.000Z",
       "currentPhase": "build",
       "currentStep": "implement",
       "lastUpdatedAgoMs": 7320000
     }
     ```
   - `action: "resumed"` — only happens if you passed `--worktree-root` directly (not the default flow).

2. **Show the list to the user.** Format it as a numbered list with: slug, status, current phase/step, **last updated time** (humanized from `lastUpdatedAgoMs`), and branch. The last-updated column is critical — it lets the user spot a session that was "closed by mistake" (high age + `in-progress` = likely a crashed terminal). Example:
   ```
   Found 3 resumable sessions (most recent first):
     1. fix-csv-export        in-progress  (test/exercise,    updated 30s ago)   ← still running elsewhere?
     2. item-count-badge      paused       (build/implement,  updated 2h ago)    feat/item-count-badge
     3. dark-mode-toggle      in-progress  (plan/understand,  updated 3d ago)    ← likely abandoned
   Which one do you want to resume? (number or slug)
   ```
   When you see an `in-progress` session with a recent `lastUpdatedAgoMs` (< a few minutes), warn the user that another Claude instance may still be working on it. When you see one with a large age, hint that it was probably closed without pausing.
   Wait for the user to reply.

3. Once the user picks one, resolve it to a slug and run:
   ```bash
   work-kit resume --slug <slug>
   ```
   The result will be `action: "resumed"` with `worktreeRoot`, `phase`, and `step` populated.

4. **`cd` into the returned `worktreeRoot`.** All subsequent commands must run from there, not from the main repo root.

5. Continue the orchestrator loop (same as `/full-kit` / `/auto-kit`):
   ```bash
   work-kit next
   ```
   Then follow the action returned (`spawn_agent`, `spawn_parallel_agents`, `wait_for_user`, etc.) using the Agent tool. Keep looping `work-kit next` until you hit `wait_for_user`, `complete`, or `error`.

## Notes

- `work-kit resume` (no args) is read-only — it just lists paused sessions, it doesn't flip any state. State changes only happen on `--slug`.
- `work-kit resume --slug <slug>` is idempotent: if the matched session is already in-progress, it returns `action: "resumed"` without re-writing the tracker.
- A paused session keeps all state — phases, steps, loopbacks, timing — exactly as they were.
- If the user invokes `/resume-kit <slug>` (passing a slug directly), skip the listing step and call `work-kit resume --slug <slug>` immediately.
