---
name: wrap-up
description: "Final step: Synthesize all phase outputs into a work-kit log summary and clean up."
user-invocable: false
allowed-tools: Bash, Read, Write, Edit, Glob, Grep
---

# Wrap-up

**Role:** Work Historian
**Goal:** Produce a concise, useful summary of what was built and why — then clean up.

## Instructions

> **Note:** Archiving state.md and appending to `.claude/work-kit/index.md` are handled automatically by the CLI when you run `work-kit complete` on the last sub-stage. You do NOT need to do these manually.

1. **Read the full `.work-kit/state.md`** — every phase output from Plan through the last completed phase
2. **Synthesize the work-kit log entry** — not a copy-paste of state, but a distilled record that a future developer (or agent) would find useful
3. **Write the summary file** to `.claude/work-kit/<date>-<slug>.md` on the **main branch** (not the worktree)
4. **Ask the user** if they want the worktree and branch removed

## Work-Kit Log Entry Format

Write to `.claude/work-kit/<YYYY-MM-DD>-<slug>.md`:

```markdown
---
slug: <slug>
branch: feature/<slug>
pr: <#number or n/a>
started: <YYYY-MM-DD>
completed: <YYYY-MM-DD>
status: <completed | partial | rolled-back>
---

## Summary
<2-3 sentences: what was built, why it was needed, and the end state>

## Criteria
<copy the final criteria checklist from state.md — checked and unchecked>

## Key Decisions
<only the non-obvious ones — decisions where the alternative was reasonable>
- <decision>: <what was chosen> — <why, in one line>

## Deviations from Plan
<anything that changed between Blueprint and final implementation — skip if none>
- <what changed and why>
```

## What to Include vs. Exclude

**Include:**
- Decisions where you chose between real alternatives
- Deviations from the Blueprint (and why)
- Anything a future developer would need to understand the "why" behind the code
- Criteria status — what was met, what wasn't

**Exclude:**
- Artifact lists (files, PRs, migrations) — derivable from git
- Routine implementation details ("created file X, modified file Y")
- Full phase outputs — the summary is a distillation, not a dump
- Internal process notes ("ran tests 3 times before they passed")
- Anything derivable from the git diff or PR description

## Boundaries

### Always
- Read the full state.md before writing the summary
- Include every non-obvious decision in the Key Decisions section
- Include every deviation from the Blueprint in the Deviations section
- Write the archive to the main branch, not the worktree

### Ask First
- Deleting the worktree and feature branch (confirm with user)
- Omitting sections from the summary

### Never
- Copy-paste full phase outputs into the summary (distill, don't dump)
- Include routine implementation details (file lists, command logs)
- Skip the criteria checklist in the summary
- Commit the archive on the feature branch instead of main

## Cleanup

After writing the summary:

1. Switch to main branch: `cd` back to the main repo root
2. Stage and commit all work-kit log files:
   ```bash
   git add .claude/work-kit/
   git commit -m "work-kit: <slug>"
   ```
3. Remove the worktree and delete the feature branch (merge already happened, cleanup is safe):
   ```bash
   git worktree remove worktrees/<slug> --force
   git branch -d feature/<slug> 2>/dev/null || true
   ```
4. Report: summary written, worktree removed, branch deleted, done.
