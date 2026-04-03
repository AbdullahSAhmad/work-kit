---
description: "Review sub-stage: Check for performance issues."
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

Fix what you can. Document what needs deeper investigation.

## Output (append to state.md)

```markdown
### Review: Performance

**Findings:**
- <finding — or "None">

**Fixes Applied:**
- <what was fixed — or "None">

**Recommendations:**
- <suggestions for future optimization — or "None">
```

## Rules

- Focus on actual problems, not theoretical ones
- Don't prematurely optimize code that runs once on page load
- DO flag anything that scales with data (queries, list renders, loops)
- If you add an index, include it in the migration or note it as needed
