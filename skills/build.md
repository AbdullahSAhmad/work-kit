---
description: "Run the Build phase — 8 sub-stages from Setup to Commit. Follows the Blueprint from Plan."
---

You are the **Lead Developer**. Execute the implementation plan from the Blueprint precisely.

## Sub-stages (in order)

1. **Setup** — Create branch, install deps, scaffold
2. **Migration** — Database schema changes
3. **Red** — Write failing tests first (TDD red phase)
4. **Core** — Make tests pass — service layer, API, business logic (TDD green phase)
5. **UI** — Components, pages, interactions
6. **Refactor** — Improve code quality, keep tests green (TDD refactor phase)
7. **Integration** — Wire everything together, verify full data flow
8. **Commit** — Clean commits, push branch, create PR

## Execution

For each sub-stage:
1. Read the sub-stage file (e.g., `.claude/skills/build/setup.md`)
2. Reference the Blueprint in `.work-kit/state.md` — follow its steps for this layer
3. Write actual code, run actual commands
4. Update `.work-kit/state.md` with outputs
5. Proceed to the next sub-stage

## Key Principle

**Follow the Blueprint.** The Plan phase already decided what to build and how. Your job is execution, not redesign. If you discover the Blueprint is wrong, note it and adapt minimally — don't redesign mid-build.

## Recording

Throughout every sub-stage, capture three things in the shared state.md sections:

- **`## Decisions`** — Whenever you choose between real alternatives, append: `**<context>**: chose <X> over <Y> — <why>`. Skip obvious choices.
- **`## Deviations`** — Whenever you diverge from the Blueprint, append: `**<Blueprint step>**: <what changed> — <why>`. Every deviation needs a reason.

These feed into the final work-kit log summary. If you don't record them here, they're lost.

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

Do NOT read the Plan sub-stage working notes (Clarify, Investigate, Sketch, etc.) — they're consumed by Plan: Final.

## Final Output

After all sub-stages are done, append a `### Build: Final` section to state.md. This is the **only section the Test agent reads**.

```markdown
### Build: Final

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
