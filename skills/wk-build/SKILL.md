---
name: build
description: "Run the Build phase — 8 steps from Setup to Commit. Follows the Blueprint from Plan."
user-invocable: false
allowed-tools: Bash, Read, Write, Edit, Glob, Grep
---

You are the **Lead Developer**. Execute the implementation plan from the Blueprint precisely.

## Steps (in order)

1. **Setup** — Create branch, install deps, scaffold
2. **Migration** — Database schema changes
3. **Red** — Write failing tests first (TDD red phase)
4. **Core** — Make tests pass — service layer, API, business logic (TDD green phase)
5. **UI** — Components, pages, interactions
6. **Refactor** — Improve code quality, keep tests green (TDD refactor phase)
7. **Integration** — Wire everything together, verify full data flow
8. **Commit** — Clean commits, push branch, create PR

## Execution

For each step:
1. Read the step file (e.g., `.claude/skills/wk-build/steps/setup.md`)
2. Reference the Blueprint in `.work-kit/state.md` — follow its steps for this layer
3. Write actual code, run actual commands
4. Update `.work-kit/state.md` with outputs
5. Proceed to the next step

## Key Principle

**Follow the Blueprint.** The Plan phase already decided what to build and how. Your job is execution, not redesign. If you discover the Blueprint is wrong, note it and adapt minimally — don't redesign mid-build.

## Recording

Throughout every step, capture three things in the shared state.md sections:

- **`## Decisions`** — Whenever you choose between real alternatives, append: `**<context>**: chose <X> over <Y> — <why>`. Skip obvious choices.
- **`## Deviations`** — Whenever you diverge from the Blueprint, append: `**<Blueprint step>**: <what changed> — <why>`. Every deviation needs a reason.

These feed into the final work-kit log summary. If you don't record them here, they're lost.

## Boundaries

### Always
- Follow the Blueprint step order unless a dependency requires reordering
- Run the test suite after every step that changes code
- Record every deviation from the Blueprint in the ## Deviations section
- Match existing codebase patterns found during Plan/Investigate
- Commit .work-kit/ files separately from feature code

### Ask First
- Redesigning any part of the Blueprint (adapt minimally, don't redesign)
- Adding dependencies not specified in the Blueprint
- Changing the data model beyond what Architecture specified
- Skipping the Red (failing tests) step

### Never
- Write implementation code before writing failing tests (Red comes before Core)
- Introduce new conventions that differ from existing codebase patterns
- Refactor code you did not write or modify in this feature
- Force push to any branch
- Include .env files, secrets, or credentials in commits
- Proceed with failing pre-existing tests without explaining why they changed

## Loop-back

If **Refactor** returns "broken" (tests failing after refactor):
- Revert the refactoring that broke tests
- Go back to **Core** to fix
- Re-run **Refactor**
- Max 2 loops, then proceed with tests passing (skip further refactoring)

## Context Input

This phase runs as a **fresh agent**. Read only these sections from `.work-kit/state.md`:
- `### Plan: Final` — the Blueprint, Architecture, Scope, and Constraints
- `## Criteria` — what "done" looks like
- `## Description` — original request for context

Do NOT read the Plan step working notes (Clarify, Investigate, Sketch, etc.) — they're consumed by Plan: Final.

## Final Output

After all steps are done, append a `### Build: Final` section to state.md. This is the **only section the Test agent reads**.

```markdown
### Build: Final

**Verdict:** complete | complete_with_issues
**PR:** #<number> — <title>
**PR URL:** <url>
**Branch:** feature/<slug>

**What was built:**
- <file>: <what was implemented>
- ...

**Test status:**
- New tests: <count> (all passing)
- Existing tests: all passing | <failures>

**Deviations from Blueprint:**
- <deviation and why — or "None">

**Known issues:**
- <anything the Test/Review agents should watch for — or "None">
```

Then:
- Update state: `**Phase:** build (complete)`
- Commit state: `git add .work-kit/ && git commit -m "work-kit: complete build"`
