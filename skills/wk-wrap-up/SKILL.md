---
name: wrap-up
description: "Final step: Synthesize all phase outputs into a work-kit log summary and clean up."
user-invocable: false
allowed-tools: Bash, Read, Write, Edit, Glob, Grep
---

# Wrap-up

**Role:** Work Historian
**Goal:** Produce a concise, useful summary of what was built and why — then clean up.

This phase has **two steps** (in order):

1. **`wrap-up/summary`** — distill state.md into a useful summary for future developers. See `.claude/skills/wk-wrap-up/steps/summary.md`.
2. **`wrap-up/knowledge`** — harvest learnings from this session into the project's `.work-kit-knowledge/` files so the next session benefits. See `.claude/skills/wk-wrap-up/steps/knowledge.md`.

The summary you write goes into `.work-kit/summary.md`; the CLI archives it into `.work-kit-tracker/archive/<slug>-<date>/` when you call `work-kit complete wrap-up/summary --outcome done`. After summary completes, the `knowledge` step runs `work-kit extract` and (optionally) one or more `work-kit learn` calls.

## Instructions

### Step 1: summary
1. **Read the full `.work-kit/state.md`** — every phase output from Plan through the last completed phase
2. **Synthesize the summary** — not a copy-paste of state, but a distilled record that a future developer (or agent) would find useful
3. **Write `.work-kit/summary.md`** in the format described in the step file
4. **Run** `work-kit complete wrap-up/summary --outcome done`

### Step 2: knowledge
5. **Run `work-kit extract`** — mechanically routes Observations / Decisions / Deviations / loopbacks into `.work-kit-knowledge/` files
6. **Review the summary you just wrote** for subjective additions the parser would miss. For each, call `work-kit learn --type <lesson|convention|risk|workflow> --text "..."`.
7. **Run** `work-kit complete wrap-up/knowledge --outcome done`

### Cleanup
8. **Ask the user** if they want the worktree and branch removed

## Summary File Format

Overwrite `.work-kit/summary.md`:

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

## Archive Folder Structure

The CLI creates this automatically — you only need to overwrite `summary.md`:

```
.work-kit-tracker/archive/<slug>-<date>/
├── state.md          # full phase outputs (raw, from .work-kit/state.md)
├── tracker.json      # full JSON tracker (phases, timing, status)
└── summary.md        # distilled wrap-up summary (YOU write this)
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
   git add .work-kit-tracker/
   git commit -m "work-kit: <slug>"
   ```
3. Remove the worktree and delete the feature branch (merge already happened, cleanup is safe):
   ```bash
   git worktree remove worktrees/<slug> --force
   git branch -d feature/<slug> 2>/dev/null || true
   ```
4. Report: summary written, worktree removed, branch deleted, done.
