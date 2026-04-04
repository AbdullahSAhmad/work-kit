---
description: "Build sub-stage: Improve code quality while keeping all tests green (TDD refactor phase)."
---

# Refactor

**Role:** Code Quality Engineer
**Goal:** Clean up implementation code while maintaining all passing tests.

## Instructions

1. Run full test suite — confirm everything passes before starting
2. Review code for:
   - Duplication that should be extracted
   - Unclear naming
   - Functions that are too long
   - Missing error handling at system boundaries
   - Dead code or unused imports
3. Refactor incrementally — run tests after each change
4. If tests break: **stop immediately**, revert the breaking change

## Output (append to state.md)

```markdown
### Build: Refactor

**Refactoring Summary:**
- <what was improved and why>

**Changes Made:** <N> files touched
**Tests:** before=<N> passing, after=<N> passing
**Test Status:** passing | broken

**If broken:**
- What broke: <description>
- Reverted: yes/no
```

## Outcome Routing

- **passing** → All tests green, proceed to Integration
- **broken** → Tests broke and couldn't recover. Loop back to Core to fix.

## Rules

- Tests MUST be green before AND after refactoring
- Don't add new features during refactor — only improve existing code
- Don't refactor code you didn't write/modify in this feature
- If code is already clean, say so and move on — don't refactor for its own sake
- Small, incremental changes — not a big-bang rewrite

## Anti-Rationalization

| Excuse | Reality |
|--------|---------|
| "The code is fine as-is, nothing to refactor" | Fresh code always has cleanup opportunities — redundant variables, unclear names, duplicated logic. Read your code as if reviewing someone else's PR. |
| "I should refactor this unrelated code too" | Refactor only touches code you wrote or modified in this feature. Unrelated refactoring expands the diff, makes review harder, and risks regressions in code you don't fully understand. |
| "Tests are flaky, the refactoring didn't really break them" | If tests fail after refactoring, the refactoring changed behavior. Flaky tests that suddenly fail consistently are not flaky — they caught something. Investigate before dismissing. |
