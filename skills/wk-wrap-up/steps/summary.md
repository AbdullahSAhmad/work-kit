# Step: Summary

**Phase:** Wrap-up
**Role:** Work Historian
**Goal:** Distill the full state.md into a useful summary for future developers, then clean up.

## Workflow

The CLI archives `state.md`, `tracker.json`, and (if you wrote one) `summary.md` into
`.work-kit-tracker/archive/<slug>-<date>/` automatically when the wrap-up step completes.
It also appends a row to `.work-kit-tracker/index.md`.

**Your job:** write a real `summary.md` to `.work-kit/summary.md` *before* calling
`work-kit complete wrap-up/summary`. The CLI will pick it up and place it in the archive.

## Instructions

1. **Read the full `.work-kit/state.md`** — every phase output from Plan through Deploy.
2. **Synthesize the summary** — not a copy-paste; a distillation a future developer can use.
3. **Write `.work-kit/summary.md`** with the format below.
4. **Run** `work-kit complete wrap-up/summary --outcome done`.
5. **Ask the user** if they want the worktree and feature branch removed (use `work-kit cancel` only if no merge happened; otherwise prefer `git worktree remove`).

## Summary File Format

Write to `.work-kit/summary.md`:

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

## Include vs. Exclude

**Include:**
- Decisions where you chose between real alternatives
- Deviations from the Blueprint (and why)
- Anything a future developer would need to understand the "why" behind the code
- Criteria status — what was met, what wasn't

**Exclude:**
- Artifact lists (files, PRs, migrations) — derivable from git
- Routine implementation details ("created file X, modified file Y")
- Full phase outputs — distill, don't dump
- Internal process notes ("ran tests 3 times before they passed")

## Boundaries

### Always
- Read the full state.md before writing the summary
- Include every non-obvious decision in Key Decisions
- Include every deviation from the Blueprint in Deviations

### Never
- Copy-paste full phase outputs into the summary
- Skip the criteria checklist

## After Completion

When you call `work-kit complete wrap-up/summary --outcome done`, the CLI:

1. Creates `.work-kit-tracker/archive/<slug>-<date>/`
2. Copies `state.md`, `tracker.json`, and `summary.md` into it
3. Appends a row to `.work-kit-tracker/index.md`

You may then commit the archive to the main branch and remove the worktree.
