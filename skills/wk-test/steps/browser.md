---
description: "Test step: Drive the running app via Chrome DevTools MCP and verify each user-facing acceptance criterion."
---

# Browser

**Role:** Live Browser Verifier
**Goal:** Exercise the running application through Chrome DevTools MCP and confirm each user-facing acceptance criterion behaves correctly in a real browser. The unit test suite (`verify`) and end-to-end suite (`e2e`) check what the developer wrote — `browser` checks what the user will actually see.

## Driver: Chrome DevTools MCP

This step uses the **Chrome DevTools MCP** server. There is no `*.spec.ts` file to write or maintain — you drive the browser interactively using MCP tools, the same way you use `Bash` or `Read`.

If the MCP isn't available, `work-kit doctor` will have warned at session start. In that case:
- Skip this step gracefully
- Append `### Test: Browser` with `**Verdict:** skipped` and the reason
- Continue to the next test step

## When this step runs

- **full-kit**: every UI session
- **auto-kit**: `feature` and `large-feature` classifications, only when the request involves UI
- **non-UI work**: skipped automatically by the workflow matrix

The Test phase parallelizes `verify`, `e2e`, and `browser` — you run alongside them. If e2e is also enabled and they share a dev server, coordinate so you don't crash each other (see Rules below).

## Instructions

1. **Check the dev server.** Read project config (or `## Description` / `### Plan: Final`) to find how the dev server is started. If it isn't already running:
   - Start it in the background
   - Wait for it to be reachable (poll the health endpoint or root URL)
   - Note the port

2. **List the user-facing flows to verify.** Pull from `### Plan: UX Flow` if present, otherwise from the user-facing acceptance criteria in `## Criteria`. Each flow should be one observable user action with one observable outcome.

3. **For each flow:**
   - Use Chrome DevTools MCP to navigate to the relevant URL
   - Perform the action (click, type, submit, etc.)
   - Observe the result (text, element state, URL change, network response)
   - Capture a screenshot to `.work-kit/test-browser/<flow-name>.png` for the record
   - Capture any console errors or failed network requests

4. **Record verdicts.** For each flow: `pass | fail | skip` with a one-sentence note.

5. **Decide outcome:**
   - `done` — all flows pass
   - `needs_debug` — a flow fails in a way you can't immediately diagnose (the debug skill will help)
   - `blocked` — dev server won't start, MCP unreachable, or environment broken

## Output (append to state.md)

```markdown
### Test: Browser

**Verdict:** pass | fail | skipped
**Driver:** Chrome DevTools MCP
**Dev Server:** <URL or "not started — skipped">

**Flows:**
- [pass|fail|skip] <flow name> — <one-sentence observation>
- ...

**Console Errors:** <count + brief or "None">
**Failed Requests:** <count + brief or "None">
**Screenshots:** .work-kit/test-browser/

**Notes:**
<anything the Validate step needs to know — or "None">
```

## Rules

### Always
- Verify against the **running app**, not against source files. The point of this step is catching things that pass unit tests but break in the browser.
- Capture screenshots even for passing flows — they're cheap evidence and help future debugging.
- Use the user-facing criteria as the source of truth for what to test, not the implementation.
- Tear down anything you started (dev server, browser session) when you finish.

### Never
- Mock or stub the backend. If the backend is broken, that's a real failure — record it.
- Skip flows because they're "obviously fine" without actually loading them.
- Disable console error capture to avoid noise. Console errors are signal.
- Run while another test step is hammering the same dev server endpoint — coordinate via the dev server lifecycle (start once, share, don't kill mid-run).

## Anti-Rationalization

| Excuse | Reality |
|--------|---------|
| "The unit tests passed, browser is just duplication" | Unit tests prove pieces work in isolation. Browser proves the assembly works for a real user. Unit-passing + browser-failing is the most common ship-broken pattern. |
| "The console errors are unrelated to my change" | Then suppress them in code, not by ignoring them here. Unrelated console errors mean someone else's broken thing is hiding inside your safety net. |
| "I'll skip the screenshots, they take time" | They take seconds. They're invaluable when something regresses three weeks from now and you want to know what the page looked like the day it shipped. |
| "MCP isn't installed, I'll do the test manually" | Manual is fine for the user, not for this skill. If MCP is missing, mark `skipped` with the reason and let the user install it later. The pipeline must not stall on missing tooling. |
