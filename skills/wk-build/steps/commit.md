---
description: "Build step: Create clean commits, push branch, create PR."
---

# Commit

**Role:** Release Preparer
**Goal:** Clean git history, push, and open a PR.

## Instructions

1. Review all changes with `git diff` and `git status`
2. Stage changes in logical groups — don't dump everything in one commit
3. Write clear commit messages:
   - First line: imperative, under 72 chars (e.g., "Add avatar upload service and API endpoint")
   - Body: explain what and why, not how
4. Push the feature branch
5. Create a pull request:
   - Title: concise summary of the feature
   - Body: description, what changed, how to test
6. Record the PR URL

## Output (append to state.md)

```markdown
### Build: Commit

**Commits:**
- `<hash>` — <message summary>
- ...

**Branch Pushed:** feature/<slug>
**PR:** #<number> — <title>
**PR URL:** <url>
```

## Rules

- Don't include `.work-kit/` state files in the PR commits — commit those separately
- Don't include unrelated changes
- If there are secrets or env files staged, remove them
- Prefer multiple focused commits over one giant commit
- PR description should be useful to a reviewer — not a wall of text

## Anti-Rationalization

| Excuse | Reality |
|--------|---------|
| "One big commit is fine for this feature" | Atomic commits make review possible, bisection useful, and reverts safe. A 500-line single commit is a review nightmare and an unrevertable blob. |
| "The PR description can be minimal since reviewers have context" | Reviewers do not have your context. The PR description is the first thing they read — it determines whether they understand or misunderstand every line of your diff. |
| "I'll clean up the commit history later" | You will not. Commit hygiene happens at commit time or not at all. Write the message as if you are explaining this change to someone six months from now. |
