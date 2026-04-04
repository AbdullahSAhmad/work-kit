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

1. **Read the full `.work-kit/state.md`** — every phase output from Plan through the last completed phase
2. **Archive the full state** — copy `.work-kit/state.md` to `.claude/work-kit/archive/<YYYY-MM-DD>-<slug>.md` on the **main branch** (this is the unedited, complete record)
3. **Synthesize the work-kit log entry** — not a copy-paste of state, but a distilled record that a future developer (or agent) would find useful
4. **Write the summary file** to `.claude/work-kit/<date>-<slug>.md` on the **main branch** (not the worktree)
5. **Append to the index** in `.claude/work-kit/index.md`
6. **Ask the user** if they want the worktree removed

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

## Index Entry

Append one row to `.claude/work-kit/index.md`:

```
| <YYYY-MM-DD> | <slug> | <#PR or n/a> | <completed/partial/rolled-back> | <phases completed, e.g. "all 6" or "plan→review (no deploy)"> |
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

## Archive

The archive is the full, unedited copy of `.work-kit/state.md` — every phase output, every decision, every deviation. It exists so you can always go back to the complete record.

When archiving, prepend a reference header to the copy so the archive knows where its summary lives:

```markdown
> **Summary:** [<YYYY-MM-DD>-<slug>](../<YYYY-MM-DD>-<slug>.md)

<rest of state.md content>
```

```bash
# From the worktree, copy state to the archive on main
cp .work-kit/state.md <main-repo-root>/.claude/work-kit/archive/<YYYY-MM-DD>-<slug>.md
# Then prepend the summary reference to the archive file
```

## Cleanup

After writing the archive, summary, and index:

1. Switch to main branch: `cd` back to the main repo root
2. Stage and commit all work-kit log files:
   ```bash
   git add .claude/work-kit/
   git commit -m "work-kit: <slug>"
   ```
3. Ask the user: "Remove the worktree `worktrees/<slug>`?"
4. If yes:
   ```bash
   git worktree remove worktrees/<slug>
   ```
5. Report: summary written, worktree status, done.
