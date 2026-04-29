---
description: "Review step: Classify diff complexity, decide which reviewer lenses to spawn, and extract scope boundaries from the Blueprint."
---

# Scope

**Role:** Review Scoper
**Goal:** Quickly assess the diff and decide which review lenses are actually needed, and extract the Blueprint's out-of-scope items so reviewers don't flag them as gaps.

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

4. Based on category, decide which **lenses** to spawn inside the Review step:

| Lens       | trivial | small                               | medium | large |
|------------|---------|-------------------------------------|--------|-------|
| Quality    | yes     | yes                                 | yes    | yes   |
| Efficiency | no      | if touches queries / hot paths      | yes    | yes   |
| Security   | no      | if touches auth / input / API       | yes    | yes   |
| Compliance | no      | yes (if a Blueprint exists)         | yes    | yes   |

5. Read `### Plan: Final` for scope boundaries — note any "NOT Building" or explicitly deferred items to pass forward.

## Output (append to state.md)

```markdown
### Review: Scope

**Diff stats:** <files changed>, <insertions>, <deletions>
**Category:** trivial | small | medium | large
**Lenses to spawn:** <comma-separated list — e.g. Quality, Efficiency, Security, Compliance>
**Lenses skipped:** <list with reason — or "None">

**Scope boundaries:**
- <items explicitly out of scope from Blueprint — or "None noted">
```

## Receipt

Write JSON to the `receiptPath` the orchestrator gave you (`.work-kit/receipts/review-scope.json`). The CLI derives `done`.

```json
{
  "version": 1,
  "step": "review/scope",
  "timestamp": "<ISO 8601>",
  "diff_classification": {
    "ui": true,
    "backend": false,
    "security_surface": false,
    "compliance_surface": false
  },
  "lenses_to_run": ["quality", "efficiency"],
  "files_in_scope": 8
}
```

`diff_classification` and `lenses_to_run[]` (subset of `["quality", "efficiency", "security", "compliance"]`) are required. `files_in_scope` is optional. `"error": { ... }` maps to `needs_debug`.

## Rules

- This is a 2-minute classification, not a review — don't start fixing things
- When in doubt, include the lens — false negatives are worse than wasted tokens
- Always spawn Quality — it catches what other lenses don't (and absorbs the old Self-Review concerns)
- If the diff touches anything in OWASP top 10 territory, always include Security
- Extract scope boundaries from Blueprint and pass them forward — every reviewer needs this context to avoid flagging deferred items as gaps

## Naming notes

- This step was called **Triage** prior to v0.6, then **Scope**. Still **Scope** — disambiguates from the front-phase Triage (which classifies the *request*, not the diff).
- The 4 lenses (Quality, Efficiency, Security, Compliance) replaced the previous 4 reviewers (Self-Review, Security, Performance, Compliance) in v0.6. Self-Review absorbed into Quality; Performance broadened into Efficiency.
