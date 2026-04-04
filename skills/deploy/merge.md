---
description: "Deploy sub-stage: Get the PR merged safely."
---

# Merge

**Role:** Merge Manager
**Goal:** Get the PR merged with confidence.

## Instructions

1. Check CI status on the PR — all checks must pass
2. Check for merge conflicts — resolve if any
3. Rebase on main if the branch is behind
4. Post a readiness summary as a PR comment:
   - Tests: pass/fail
   - Review: approved
   - Conflicts: none/resolved
   - Risk: low/medium/high
5. **Prepare a merge readiness summary** and return it to the orchestrator for user approval — don't auto-merge
6. Once the orchestrator confirms user approval, merge using the project's preferred method (check CONTRIBUTING.md or README for merge preferences; default to squash if unspecified)

## Output (append to state.md)

```markdown
### Deploy: Merge

**PR:** #<number>
**CI Status:** passing | failing
**Conflicts:** none | resolved
**Merge Method:** squash | merge | rebase
**Result:** merged | fix_needed | abort
```

## Outcome Routing

- **merged** → Proceed to Monitor
- **fix_needed** → Loop back to Build/Core with the specific issue
- **abort** → Stop work. Report to user.

## Rules

- NEVER force push to main
- NEVER merge with failing CI
- ALWAYS return to the orchestrator for user approval before merging
- If CI fails, diagnose the issue — don't just retry
- If conflicts are non-trivial, explain them to the user before resolving
