---
name: cancel-kit
description: "Cancel the active work-kit session. Removes state, worktree, and feature branch."
user-invocable: true
allowed-tools: Bash, Read
---

# Cancel Kit

Cancels the active work-kit session and cleans up all artifacts.

## What it does

1. Finds the active work-kit session (via `bootstrap`)
2. Confirms with the user before proceeding
3. Runs `work-kit cancel` to:
   - Remove `.work-kit/` state directory
   - Remove the git worktree
   - Delete the feature branch
4. Reports what was cleaned up

## Instructions

1. Run `work-kit bootstrap` to detect the active session
2. If no active session: tell the user there's nothing to cancel
3. If active: show the user what will be cancelled:
   - Slug and branch name
   - Current phase and step
   - Any uncommitted work in the worktree will be lost
4. **Ask the user to confirm** — do not proceed without explicit confirmation
5. `cd` into the worktree directory
6. Run `work-kit cancel`
7. `cd` back to the main repo root
8. Report the result to the user
