---
description: "Review step: Classify diff complexity, decide which reviewers to spawn, and extract scope boundaries from the Blueprint."
---

# Scope

**Role:** Review Scoper
**Goal:** Quickly assess the diff and decide which review agents are actually needed, and extract the Blueprint's out-of-scope items so reviewers don't flag them as gaps.

## Instructions

1. Run `git diff main...HEAD --stat` to see the size of changes
2. Skim the actual diff (`git diff main...HEAD`) — spend under 2 minutes
3. Classify the diff complexity:

| Category | Description | Example |
|----------|-------------|---------|
| `trivial` | Typo fixes, comment edits, formatting-only | README update, rename a variable |
| `small` | Single-concern change, <100 lines, no new deps | Bug fix, add a field, tweak a query |
| `medium` | Multi-file feature, new logic, new dependencies | New API endpoint, new component |
| `large` | Cross-cutting change, schema changes, auth/security | New auth flow, data model redesign |

4. Based on category, decide which reviewers to spawn:

| Reviewer | trivial | small | medium | large |
|----------|---------|-------|--------|-------|
| Self-Review | yes | yes | yes | yes |
| Security | no | if touches auth/input/API | yes | yes |
| Performance | no | if touches queries/renders | yes | yes |
| Compliance | no | yes | yes | yes |

5. Read `### Plan: Final` for scope boundaries — note any "NOT Building" or explicitly deferred items to pass to reviewers.

## Output (append to state.md)

```markdown
### Review: Scope

**Diff stats:** <files changed>, <insertions>, <deletions>
**Category:** trivial | small | medium | large
**Reviewers to spawn:** <comma-separated list>
**Skipped reviewers:** <list with reason — or "None">

**Scope boundaries:**
- <items explicitly out of scope from Blueprint — or "None noted">
```

## Rules

- This is a 2-minute classification, not a review — don't start fixing things
- When in doubt, include the reviewer — false negatives are worse than wasted tokens
- Always spawn Self-Review — it catches things the others don't look for
- If the diff touches anything in OWASP top 10 territory, always include Security
- Extract scope boundaries from Blueprint and pass them forward — reviewers need this context

## Naming note

This step was called "Triage" prior to v0.6. It was renamed to **Scope** to disambiguate from the new front-phase Triage (which classifies the *request*, not the diff).
