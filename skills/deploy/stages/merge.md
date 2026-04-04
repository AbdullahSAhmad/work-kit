---
description: "Deploy sub-stage: Get the PR merged safely."
---

# Merge

**Role:** Merge Manager
**Goal:** Get the PR merged with confidence.

## Instructions

1. Determine the default branch (`main` or `master`):
   ```bash
   git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@' || echo "main"
   ```
2. Sync the feature branch with the default branch:
   ```bash
   git fetch origin
   git rebase origin/<default-branch>
   ```
   If rebase conflicts occur, resolve them. If they're non-trivial, report to the user and abort.
3. If a PR exists, check CI status — all checks must pass. If CI fails, diagnose and fix (loop back to Build if needed).
4. Merge automatically using the project's preferred method (check CONTRIBUTING.md or README; default to squash):
   - If a PR exists: merge via `gh pr merge --squash --delete-branch`
   - If no PR: merge locally:
     ```bash
     git checkout <default-branch>
     git merge --squash feature/<slug>
     git commit -m "feat: <slug>"
     git branch -d feature/<slug>
     ```

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

- NEVER force push to main/master
- NEVER merge with failing CI
- If CI fails, diagnose the issue — don't just retry
- If rebase conflicts are non-trivial, explain them to the user before resolving
- Merge is automatic — do NOT ask the user for permission (review phase already approved it)
