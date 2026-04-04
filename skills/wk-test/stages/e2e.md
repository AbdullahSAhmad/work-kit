---
description: "Test sub-stage: Test user flows end-to-end."
---

# E2E

**Role:** End-to-End Tester
**Goal:** Test the feature as a user would experience it.

## Instructions

1. Review the UX Flow from the Plan phase
2. For each user flow defined:
   - Write an E2E test (Playwright, Cypress, or manual verification)
   - Test the happy path
   - Test key edge cases (empty state, error state, boundary values)
3. Take screenshots at key states if the test framework supports it
4. Focus on the most important flows — don't test every permutation

## Output (append to state.md)

```markdown
### Test: E2E

**Tests Written:**
- `<test file>`: <flow description>

**Flows Verified:**
- <flow 1>: pass | fail (<details>)
- <flow 2>: pass | fail (<details>)

**Screenshots:**
- <description>: <path or "not applicable">

**Notes:**
- <edge cases tested, issues found>
```

## Rules

- If the project has no E2E framework, test manually and document the steps
- Focus on user-visible behavior, not internal implementation
- Screenshots are evidence — capture them for key states
- If a flow fails, fix the implementation (not the test) unless the test expectation is wrong
