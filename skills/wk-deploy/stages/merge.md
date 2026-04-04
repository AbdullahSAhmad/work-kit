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
2. Remove `.work-kit/` from git tracking before merging (state is transient — the archive in `.claude/work-kit/` is the permanent record):
   ```bash
   git rm -r --cached .work-kit/ 2>/dev/null && git commit -m "work-kit: remove transient state before merge" || true
   ```
3. Sync the feature branch with the default branch:
   ```bash
   git fetch origin
   git rebase origin/<default-branch>
   ```
   If rebase conflicts occur, resolve them. If they're non-trivial, report to the user and abort.
4. If a PR exists, check CI status — all checks must pass. If CI fails, diagnose and fix (loop back to Build if needed).
5. Merge automatically using the project's preferred method (check CONTRIBUTING.md or README; default to squash):
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

**CI Status:** passing | failing | N/A
**PR:** #<number>
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
- Merge is fully autonomous — do NOT ask the user for permission at any step (review phase already approved it)
- Push, create PR, and merge without stopping for confirmation
- The entire sync → push → PR → merge flow should complete in one agent pass

## Anti-Rationalization

| Excuse | Reality |
|--------|---------|
| "CI is probably fine, no need to wait for the check" | "Probably" is not evidence. CI exists to catch what you missed. Wait for the green check — it takes minutes and prevents shipping broken code. |
| "The conflict is trivial, I'll just force through" | Trivial conflicts still need manual resolution. Force-merging overwrites someone else's work. Resolve conflicts properly — if they are truly trivial, it takes 30 seconds. |
| "Rebasing will mess up my history, better to merge directly" | A clean rebase on the default branch catches integration issues before they reach main. The few minutes spent rebasing prevent broken builds that affect the entire team. |
