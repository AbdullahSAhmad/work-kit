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
