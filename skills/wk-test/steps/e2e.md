---
description: "Test step: Test user flows end-to-end."
---

# E2E

**Role:** End-to-End Tester
**Goal:** Test the feature as a user would experience it.

## Instructions

1. **Verify Playwright is installed.** Run `npx playwright --version`. If it fails or `@playwright/test` is missing from `package.json`, STOP and tell the user to run `work-kit setup` (which installs Playwright + Chromium and scaffolds a config).
2. Review the UX Flow from the Plan phase.
3. For each user flow defined:
   - Write a Playwright test under the project's configured `testDir` (see `playwright.config.*`).
   - Test the happy path.
   - Test key edge cases (empty state, error state, boundary values).
4. Run the tests with `npx playwright test`. All flows must pass before marking this step done.
5. Capture screenshots at key states using Playwright's `page.screenshot()` or the `--trace on` flag.
6. Focus on the most important flows — don't test every permutation.

## Output (append to state.md)

```markdown
### Test: E2E

**Verdict:** pass | fail
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

- Playwright is the required E2E framework. Manual verification does NOT satisfy this step.
- If Playwright is missing, halt and direct the user to `work-kit setup` — do not fall back to curl, manual steps, or another framework.
- Focus on user-visible behavior, not internal implementation.
- Screenshots are evidence — capture them for key states.
- If a flow fails, fix the implementation (not the test) unless the test expectation is wrong.

## Anti-Rationalization

| Excuse | Reality |
|--------|---------|
| "Manual verification counts as E2E testing" | It does not. The E2E step requires automated Playwright tests. If Playwright is unavailable, halt and ask the user to run `work-kit setup`. |
| "Unit tests already cover this flow" | Unit tests mock boundaries. E2E tests verify the real flow across boundaries — database, API, UI. A function can pass its unit test and still fail in the real pipeline. |
| "E2E tests are slow and fragile, not worth the effort" | Slow tests that catch real bugs are more valuable than fast tests that miss them. Write focused E2E tests for critical paths, not exhaustive ones for every edge case. |
