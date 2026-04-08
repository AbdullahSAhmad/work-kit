---
description: "Test step: Run the existing Playwright suite as a regression gate, and add specs only for genuinely new flows that nothing else covers."
---

# E2E

**Role:** Regression Gate + Selective Spec Author
**Goal:** Keep the cumulative Playwright suite green, and add a new spec **only** when a user flow in this session isn't already covered by an existing test. `test/browser` handles live per-session verification via Chrome DevTools MCP — this step exists for **durable regression coverage**, not session-local checks.

## Instructions

1. **Verify Playwright is installed.** Run `npx playwright --version`. If it fails or `@playwright/test` is missing from `package.json`, STOP and tell the user to run `work-kit setup` (which installs Playwright + Chromium and scaffolds a config).

2. **Run the existing suite first.** `npx playwright test`. This is the regression gate — if anything the previous sessions wrote is now broken, you catch it here before touching anything new.
   - All pre-existing tests must still pass.
   - Regressions → fix the implementation (not the test), unless the test encodes a behavior that intentionally changed in this session. In that case, update the test *with a comment* explaining why.

3. **Identify genuinely new flows.** Read `### Plan: UX Flow` and `## Criteria`. For each user flow in this session, ask:
   - Does an existing spec under `testDir` already exercise this flow? (Grep for selectors, route paths, or the feature name.)
   - If yes: **do not add a duplicate spec.** `test/browser` will cover the live verification; e2e's job here is done.
   - If no: add **one** focused spec that covers the happy path + one or two critical edge cases. Not exhaustive permutations.

4. **Re-run the suite** after any new spec is added. `npx playwright test`. Everything must be green.

5. **Capture screenshots** only for new specs, via `page.screenshot()` or `--trace on`. Skip screenshots for existing specs — they're already in the regression record.

## Spec Discipline (important)

The suite is **cumulative** across sessions — every spec you add sticks around forever and becomes maintenance burden. Before adding any new spec:

- **Prefer extending an existing spec** to adding a new file. If a relevant spec exists, add a `test(...)` block inside it rather than creating a sibling file.
- **Write for the flow, not the feature.** A "user can log in" spec shouldn't be rewritten just because you added a new login method — extend it.
- **No spec per session.** If the session made a small tweak to a flow that already has a spec, don't add a second spec for the tweak.
- **Delete stale specs when you legitimately replace behavior** instead of leaving `.skip`'d husks.

When in doubt: **don't write the spec.** `test/browser` will verify the feature works live; the next session that actually needs regression coverage for this flow can add it.

## Output (append to state.md)

```markdown
### Test: E2E

**Verdict:** pass | fail
**Suite Result:** <X passing, Y failing> (pre-existing + any new)
**Regressions Found:** <none | list of existing specs that broke + fixes applied>

**New Specs Added:**
- `<test file>`: <flow description — or "None — existing specs already cover this session's flows">

**New Specs Skipped (already covered):**
- <flow> — covered by `<existing spec file>`
- ... or "N/A"

**Screenshots (new specs only):**
- <description>: <path or "not applicable">

**Notes:**
- <anything the Validate step needs to know>
```

## Rules

- Playwright is the required E2E framework. Manual verification does NOT satisfy this step.
- If Playwright is missing, halt and direct the user to `work-kit setup` — do not fall back to curl, manual steps, or another framework.
- **Run the existing suite first**, always. A regression in pre-existing tests is more important than adding new coverage.
- **No new spec unless coverage is genuinely missing.** Duplicate specs are a tax on every future session.
- Focus on user-visible behavior, not internal implementation.
- If a flow fails, fix the implementation (not the test) unless the test encodes a behavior that intentionally changed this session.

## Anti-Rationalization

| Excuse | Reality |
|--------|---------|
| "Every session should add its own spec for documentation" | No. Specs are executable safety nets, not docs. An unneeded spec adds flakiness and maintenance with zero regression value over the spec that already covers the flow. |
| "I'll add a spec just in case — it can't hurt" | It can. Each spec adds suite runtime, a selector that can rot, and a merge-conflict surface. "Just in case" accumulates until the suite is 20 minutes long and half-skipped. |
| "Manual verification counts as E2E testing" | It does not. This step either runs Playwright green or halts. Live verification is `test/browser`'s job, not a fallback for e2e. |
| "Unit tests already cover this flow" | Unit tests mock boundaries. E2E tests verify the real flow across database, API, and UI. Keep the e2e spec if no unit+integration combination could catch a boundary regression. |
| "The existing spec is close enough, I'll write a new one anyway" | Extend the existing spec with a new `test(...)` block instead. Two specs for nearly the same flow is worse than one spec that covers both cases. |
