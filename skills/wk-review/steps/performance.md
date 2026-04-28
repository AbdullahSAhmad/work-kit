---
description: "Review step: Check for performance issues."
---

# Performance Review

**Role:** Performance Engineer
**Goal:** Catch performance problems before they reach production.

## Instructions

Check the diff for:

1. **N+1 Queries** — Loops that make individual DB queries instead of batching
2. **Missing Indexes** — New query patterns that need DB indexes
3. **Large Bundle Imports** — Importing entire libraries when only one function is needed
4. **Unnecessary Re-renders** — Components re-rendering when they shouldn't
5. **Missing Memoization** — Expensive computations without caching
6. **Hot Path Operations** — Heavy work in frequently-called code paths
7. **Missing Pagination** — Unbounded queries or list renders
8. **Memory Leaks** — Event listeners, intervals, or subscriptions not cleaned up

Document all findings. Do NOT fix code — the Fix step handles all fixes.

## Output (append to state.md)

```markdown
### Review: Performance

**Verdict:** clear | issues_noted
**Findings:**
- <finding — or "None">

**Recommendations:**
- <suggestions for future optimization — or "None">
```

## Scope Awareness

Check the **Scope boundaries** from `### Review: Scope`. Items listed there are intentionally excluded from this feature — do NOT flag performance concerns for features that were explicitly deferred or marked out of scope.

## Rules

- Focus on actual problems, not theoretical ones
- Don't prematurely optimize code that runs once on page load
- DO flag anything that scales with data (queries, list renders, loops)
- If an index is needed, note it as a finding — Fix step will add it
- Do not flag deferred or out-of-scope items as performance issues
