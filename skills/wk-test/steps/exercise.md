---
description: "Test step: Fan out 3 parallel lens sub-agents (Verify, E2E, Browser). Observe-and-fix-regressions only — Validate decides criteria-level verdict."
---

# Exercise

**Role:** Test Conductor
**Goal:** Run the test lenses that apply to this session — each is a focused sub-agent with a concrete job. They observe (and fix regressions). They do NOT decide whether the feature is "done"; that's Validate's job.

## How this step runs

1. Read `### Build: Final`, `### Plan: Final`, `### Plan: UX Flow` (if present), `## Criteria` — these are passed forward to sub-agents
2. Read `### Triage: Final` to know the classification (drives lens selection)
3. Decide which lenses to spawn (see "Lens selection" below)
4. **Use the Agent tool to spawn the selected lenses in a single message** — true parallel fan-out (mirrors the `simplify` skill's pattern). Each gets its lens spec from this file plus the relevant context
5. Wait for all to complete. Each writes its own `### Test: <Lens>` section to state.md
6. After all lenses finish, append a `### Test: Roundup` section summarizing pass/fail per lens

The sub-agents share a dev server when both E2E and Browser run — coordinate via "start once, share, don't kill mid-run". The Verify lens is process-isolated (unit suite) and doesn't conflict.

## Lens selection

| Lens    | bug-fix | small-change | refactor | feature           | large-feature |
|---------|---------|--------------|----------|-------------------|---------------|
| Verify  | yes     | yes          | yes      | yes               | yes           |
| E2E     | no      | no           | no       | if UI + Playwright| if Playwright |
| Browser | no      | no           | no       | if UI + MCP       | if UI + MCP   |

- **Verify** always runs. The unit suite is the regression gate.
- **E2E** is gated on Playwright being installed (`@playwright/test` in package.json). If missing, the lens skips itself with a note — do not halt the phase.
- **Browser** is gated on Chrome DevTools MCP being available. `work-kit doctor` will have warned at session start if it isn't. If missing, the lens writes `**Verdict:** skipped` with the reason.

When a lens is genuinely not applicable (e.g., a backend-only refactor), include it in **Lenses skipped** in the Roundup with the reason.

## Universal lens rules (apply to every lens)

These rules ride along in every sub-agent prompt. The Conductor pastes them into each invocation.

- **Run, then fix regressions** — every lens runs its real harness against the running code. If a pre-existing test fails because of this session's diff, that's a regression — fix the implementation (not the test) unless behavior intentionally changed.
- **No skipping or disabling tests** — fix the underlying issue. Disabling a flaky test erodes the safety net.
- **Evidence-first** — every assertion ("flow X works", "criterion Y satisfied") must point at a concrete artifact: test name, screenshot path, console output, network record. Vague claims are rejected.
- **Don't modify feature code beyond regression fixes** — Validate decides if criteria are met. If a lens spots a missing acceptance criterion, it reports the gap; it does NOT add the missing feature.
- **Redaction** — if you encounter `[redacted: N lines — @wk-ignore]` placeholders, leave them alone. Do not reconstruct or work around them. If you suspect a real failure inside one, flag it for human review.

---

## Lens A — Verify

**Role:** Regression Tester
**Goal:** Ensure nothing is broken — both new and existing unit/integration tests pass.

### Instructions

1. Run the full test suite (project's standard command — `npm test`, `pytest`, `cargo test`, etc.)
2. Check results:
   - All new tests (added in `build/implement`): should pass
   - All pre-existing tests: should still pass
3. If any test fails:
   - Determine if it's a regression (existing test broke) or a new failure (a new test doesn't pass yet)
   - Fix regressions immediately — never skip or disable
   - For new test failures, fix the implementation
4. Run the suite again after fixes to confirm clean pass

### Output

```markdown
### Test: Verify

**Verdict:** pass | fail
**Suite result:** pass | fail
**Total tests:** <N> passing, <M> failing

**Regressions found:**
- <test name> — <what broke and fix applied — or "None">

**Fixes applied:**
- <description — or "None">
```

### Anti-rationalization

| Excuse | Reality |
|--------|---------|
| "Disabling this flaky test is easier than fixing it" | A flaky test is a test with a real problem — intermittent failures often reveal race conditions or state leaks that will bite production. Fix it. |
| "The failing test was testing the old behavior" | Then update the test to match the new behavior with a comment explaining why. Deleting a test because it fails destroys evidence — it might be catching a real regression. |
| "All tests pass, so everything works" | Tests prove what they test. Validate maps criteria to evidence — passing tests with missing coverage is a false sense of security. |

---

## Lens B — E2E

**Role:** Regression Gate + Selective Spec Author
**Goal:** Keep the cumulative Playwright suite green, and add a new spec **only** when a user flow in this session isn't already covered. The Browser lens handles live per-session verification — this lens exists for **durable regression coverage**, not session-local checks.

### Instructions

1. **Verify Playwright is installed.** Run `npx playwright --version`. If it fails or `@playwright/test` is missing from `package.json`, write `**Verdict:** skipped` with reason "Playwright not installed — run `work-kit setup`" and stop. Do not fall back to curl, manual steps, or another framework.

2. **Run the existing suite first.** `npx playwright test`. This is the regression gate — if anything previous sessions wrote is now broken, you catch it here before touching anything new.
   - All pre-existing specs must still pass.
   - Regressions → fix the implementation (not the test) unless the test encodes a behavior that intentionally changed in this session. In that case, update the test *with a comment* explaining why.

3. **Identify genuinely new flows.** Read `### Plan: UX Flow` and `## Criteria`. For each user flow in this session, ask:
   - Does an existing spec under `testDir` already exercise this flow? (Grep for selectors, route paths, or feature names.)
   - If yes: **do not add a duplicate spec.** Browser lens will cover live verification; E2E's job here is done.
   - If no: add **one** focused spec covering the happy path + one or two critical edge cases. Not exhaustive permutations.

4. **Re-run the suite** after any new spec is added. Everything must be green.

5. **Capture screenshots** only for new specs, via `page.screenshot()` or `--trace on`. Skip screenshots for existing specs — they're already in the regression record.

### Spec discipline (important)

The suite is **cumulative** across sessions — every spec sticks around forever. Before adding any new spec:

- **Prefer extending an existing spec** to adding a new file. If a relevant spec exists, add a `test(...)` block inside it rather than a sibling file.
- **Write for the flow, not the feature.** A "user can log in" spec shouldn't be rewritten because you added a new login method — extend it.
- **No spec per session.** A small tweak to a flow that already has a spec doesn't earn a second spec.
- **Delete stale specs when behavior is legitimately replaced** instead of leaving `.skip`'d husks.

When in doubt: **don't write the spec.** Browser lens will verify the feature works live; the next session that genuinely needs regression coverage can add it.

### Output

```markdown
### Test: E2E

**Verdict:** pass | fail | skipped
**Suite result:** <X passing, Y failing> (pre-existing + any new) — or "skipped"
**Regressions found:** <none | list of existing specs that broke + fixes applied>

**New specs added:**
- `<test file>`: <flow description — or "None — existing specs already cover this session's flows">

**New specs skipped (already covered):**
- <flow> — covered by `<existing spec file>`
- ... or "N/A"

**Screenshots (new specs only):**
- <description>: <path or "not applicable">

**Notes:**
- <anything Validate needs to know>
```

### Anti-rationalization

| Excuse | Reality |
|--------|---------|
| "Every session should add its own spec for documentation" | Specs are executable safety nets, not docs. An unneeded spec adds flakiness and maintenance with zero regression value over the spec that already covers the flow. |
| "I'll add a spec just in case — it can't hurt" | It can. Each spec adds suite runtime, a selector that can rot, and a merge-conflict surface. "Just in case" accumulates until the suite is 20 minutes long and half-skipped. |
| "Manual verification counts as E2E testing" | It does not. This lens either runs Playwright green or marks itself skipped. Live verification is Browser lens's job, not a fallback for E2E. |
| "Unit tests already cover this flow" | Unit tests mock boundaries. E2E verifies the real flow across database, API, and UI. Keep the spec if no unit+integration combination could catch a boundary regression. |
| "The existing spec is close enough, I'll write a new one anyway" | Extend the existing spec with a new `test(...)` block instead. Two specs for nearly the same flow is worse than one spec covering both cases. |

---

## Lens C — Browser

**Role:** Live Browser Verifier
**Goal:** Exercise the running application through Chrome DevTools MCP and confirm each user-facing acceptance criterion behaves correctly in a real browser. Verify and E2E check what the developer wrote — Browser checks what the user will actually see.

### Driver: Chrome DevTools MCP

This lens uses the **Chrome DevTools MCP** server. There is no `*.spec.ts` to write — you drive the browser interactively using MCP tools, the same way you use `Bash` or `Read`.

If the MCP isn't available (`work-kit doctor` warned at session start), write `**Verdict:** skipped` with the reason and stop. Do not fall back to manual verification.

### Instructions

1. **Check the dev server.** Read project config (or `## Description` / `### Plan: Final`) to find how the dev server is started. If it isn't already running:
   - Start it in the background
   - Wait for it to be reachable (poll the health endpoint or root URL)
   - Note the port
   - If E2E lens shares the same dev server, coordinate — start once, share, don't kill mid-run

2. **List the user-facing flows to verify.** Pull from `### Plan: UX Flow` if present, otherwise from user-facing acceptance criteria in `## Criteria`. Each flow should be one observable user action with one observable outcome.

3. **For each flow:**
   - Use Chrome DevTools MCP to navigate to the relevant URL
   - Perform the action (click, type, submit, etc.)
   - Observe the result (text, element state, URL change, network response)
   - Capture a screenshot to `.work-kit/test-browser/<flow-name>.png` for the record
   - Capture any console errors or failed network requests

4. **Record verdicts.** For each flow: `pass | fail | skip` with a one-sentence note.

5. **Tear down** anything you started (dev server, browser session) when you finish — unless E2E is still using the dev server.

### Output

```markdown
### Test: Browser

**Verdict:** pass | fail | skipped
**Driver:** Chrome DevTools MCP
**Dev server:** <URL or "not started — skipped">

**Flows:**
- [pass|fail|skip] <flow name> — <one-sentence observation>
- ...

**Console errors:** <count + brief or "None">
**Failed requests:** <count + brief or "None">
**Screenshots:** .work-kit/test-browser/

**Notes:**
- <anything Validate needs to know — or "None">
```

### Anti-rationalization

| Excuse | Reality |
|--------|---------|
| "The unit tests passed, browser is just duplication" | Unit tests prove pieces work in isolation. Browser proves the assembly works for a real user. Unit-passing + browser-failing is the most common ship-broken pattern. |
| "The console errors are unrelated to my change" | Then suppress them in code, not by ignoring them here. Unrelated console errors mean someone else's broken thing is hiding inside your safety net. |
| "I'll skip the screenshots, they take time" | They take seconds. They're invaluable when something regresses three weeks from now and you want to know what the page looked like the day it shipped. |
| "MCP isn't installed, I'll do the test manually" | Manual is fine for the user, not for this lens. If MCP is missing, mark `skipped` with the reason and let the user install it later. The pipeline must not stall on missing tooling. |

---

## Roundup output

After all sub-agents complete, the Conductor (this step's main agent) appends a single roundup so Validate can plan its work:

```markdown
### Test: Roundup

**Lenses run:** <list — e.g. Verify, E2E, Browser>
**Lenses skipped:** <list with reason — or "None">

**Verdicts by lens:**
- Verify: pass | fail
- E2E: pass | fail | skipped
- Browser: pass | fail | skipped

**Total tests:** <count> (passing: <N>, failing: <N>) — sum of Verify suite + E2E suite, omits skipped lenses
**Regressions fixed:** <count>
**Failures remaining:** <count + brief or "None">
```

The Conductor does not write `### Test: Final` — Validate owns the criteria mapping and the phase verdict.
