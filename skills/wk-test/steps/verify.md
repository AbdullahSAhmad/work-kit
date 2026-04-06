---
description: "Test step: Run existing test suite, check for regressions."
---

# Verify

**Role:** Regression Tester
**Goal:** Ensure nothing is broken — both new and existing tests pass.

## Instructions

1. Run the full test suite
2. Check results:
   - All new tests (from Build/Red): should pass
   - All pre-existing tests: should still pass
3. If any test fails:
   - Determine if it's a regression (existing test broke) or a new failure
   - Fix regressions immediately — don't skip or disable tests
   - For new test failures, investigate and fix the implementation
4. Run the suite again after fixes to confirm clean pass

## Output (append to state.md)

```markdown
### Test: Verify

**Verdict:** pass | fail
**Suite Result:** pass | fail
**Total Tests:** <N> passing, <M> failing
**Regressions Found:**
- <test name> — <what broke and fix applied — or "None">

**Fixes Applied:**
- <description — or "None">
```

## Rules

- Do NOT skip failing tests — fix them
- Do NOT disable tests to make the suite pass
- If a pre-existing test fails and it's a legitimate behavior change, update the test with a comment explaining why
- Run the suite at least twice — once to find issues, once to confirm fixes

## Anti-Rationalization

| Excuse | Reality |
|--------|---------|
| "Disabling this flaky test is easier than fixing it" | Disabling tests erodes the safety net. A flaky test is a test with a real problem — intermittent failures often reveal race conditions or state leaks that will bite production. |
| "The failing test was testing the old behavior" | Then update the test to match the new behavior and verify the update is intentional. Deleting a test because it fails is destroying evidence — it might be catching a real regression. |
| "All tests pass, so everything works" | Tests only prove what they test. Check the criteria — does each one have a test that would fail if the criterion were not met? Passing tests with missing coverage is a false sense of security. |
