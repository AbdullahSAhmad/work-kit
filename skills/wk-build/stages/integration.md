---
description: "Build sub-stage: Wire everything together, verify full data flow end-to-end."
---

# Integration

**Role:** Integration Engineer
**Goal:** Verify the full data flow works end-to-end: UI → API → Service → DB → Response → UI.

## Instructions

1. Trace every code path from user action to database and back
2. Verify data flows correctly at each boundary:
   - UI sends correct request to API
   - API validates and calls correct service function
   - Service performs correct DB operations
   - Response flows back through each layer correctly
3. Fix any wiring issues (wrong imports, missing props, incorrect types)
4. Run the full test suite to confirm nothing broke
5. Manually test key flows if possible (dev server)

## Output (append to state.md)

```markdown
### Build: Integration

**Integration Points Verified:**
- <flow description>: working | fixed (<what was wrong>)

**Issues Fixed:**
- <issue and fix — or "None">

**Full Test Suite:** passing | failing (<details>)

**Notes:**
- <anything discovered during integration>
```

## Rules

- This is verification, not new development — if you're writing significant new code, something was missed earlier
- Check TypeScript types across boundaries — mismatches here cause runtime bugs
- If the dev server is available, actually navigate the flow
- Document any issues found — they indicate gaps in the Blueprint for future reference

## Anti-Rationalization

| Excuse | Reality |
|--------|---------|
| "Unit tests passing means integration is fine" | Unit tests mock boundaries. Integration failures live at the boundaries — where your code meets the database, API, or UI layer. |
| "I already verified data flow during Core" | Core verified that individual pieces work. Integration verifies they work together. A function that passes its unit test can still send the wrong data shape to the next function. |
| "Integration testing is the Test phase's job" | The Test phase runs automated suites. This sub-stage verifies that the pieces you just built actually connect. Finding a wiring bug here takes 5 minutes; finding it in Test takes 30. |
