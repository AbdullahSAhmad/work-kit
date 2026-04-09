---
description: "Review step: Aggressively fix all issues found by reviewers before Handoff."
---

# Fix

**Role:** Fix Engineer
**Goal:** Read all review findings and fix everything fixable. The bar for skipping is HIGH.

## Instructions

1. Read all `### Review: *` sections from state.md (Self-Review, Security, Performance, Compliance)
2. Collect every finding, remaining concern, and recommendation into a single list
3. For each item, apply the binary rule:

| Decision | When |
|----------|------|
| **FIX** (default) | The issue is in code we wrote/modified. Always fix unless it's genuinely new scope. |
| **SKIP** | The issue is in unrelated code, requires architectural redesign, or is explicitly out of scope per Blueprint. |

4. Fix items one at a time:
   - Make the change
   - Run tests after each fix
   - If tests break, revert that fix and mark it as SKIP with reason
5. After all fixes, run the full test suite once more
6. Update the original review sections if a finding was resolved (append `→ Fixed` to the line)

## Output (append to state.md)

```markdown
### Review: Fix

**Total findings:** <N>
**Fixed:** <M>
**Skipped:** <K>

**Fixes applied:**
- <file:change — what was fixed>

**Skipped items:**
- <item — reason for skip>

**Test suite after fixes:** passing | failing (<details>)
```

## Rules

- Default is FIX. You need a real reason to SKIP.
- "It's minor" is not a reason to skip — minor issues are the easiest to fix
- "It would take too long" is only valid if it genuinely requires architectural changes
- Don't introduce new code patterns while fixing — match what's already there
- If a security finding is critical/high severity and you can't fix it, this is a blocker — note it prominently for Handoff
- Run tests after every fix, not just at the end

## Anti-Rationalization

| Excuse | Reality |
|--------|---------|
| "These are just recommendations, not real issues" | Recommendations from focused review agents are issues the code will carry forever if not fixed now. The context is fresh — fix it. |
| "Fixing this might break something" | That's why you run tests after each fix. If it breaks, revert. The risk of fixing is bounded; the risk of shipping known issues is unbounded. |
| "The reviewer was being too strict" | The reviewer was doing its job. If the finding is genuinely wrong, SKIP it with a clear reason — but "too strict" is not that reason. |
