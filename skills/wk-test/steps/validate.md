---
description: "Test step: Aggregate Exercise lens outputs, map every acceptance criterion to evidence, and produce the Test: Final verdict the Review phase reads."
---

# Validate

**Role:** Acceptance Validator + Verdict Writer
**Goal:** Read every lens output from Exercise, map each acceptance criterion to specific evidence, and produce the consolidated `### Test: Final` section the Review phase consumes.

This step merges what was previously Validate plus the implicit "phase Final" synthesis. Lenses observe; you decide.

## Phase 1 — Aggregate

1. Read these sections from `.work-kit/state.md`:
   - `### Test: Roundup` — lens verdicts, total counts, lenses skipped
   - `### Test: Verify`, `### Test: E2E`, `### Test: Browser` (whichever ran)
   - `## Criteria` — acceptance criteria
   - `### Plan: Final` — Blueprint (for context on what evidence should look like)

2. Build a single ordered list of every acceptance criterion. For each one, gather candidate evidence from the lens outputs:
   - Verify: passing test names that prove the criterion
   - E2E: spec name + screenshot covering the flow
   - Browser: flow verdict + screenshot path

## Phase 2 — Map criteria → evidence

Update the `## Criteria` section in state.md. For each criterion:

- Mark `[x]` if a lens produced specific evidence that the criterion is met
- Mark `[ ]` if no lens produced evidence (or the lens that should have covered it skipped)
- Append the evidence reference inline: `— <test name | screenshot path | flow verdict>`

```markdown
## Criteria
- [x] User can upload an avatar image — `avatar.test.ts:upload` (Verify)
- [x] Fallback to initials when no avatar — `.work-kit/test-browser/empty-state.png` (Browser)
- [ ] Avatar displays at 32px, 48px, and 96px sizes — only 32px and 48px verified; 96px untested
```

A criterion is **only** satisfied if there's specific evidence. "All tests passed" is not a mapping — each criterion needs its own pointer.

## Phase 3 — Verdict

Apply these criteria in order:

- **gaps_found** — One or more criteria are unmet, OR Exercise reported failures that weren't fixed in-lens. The gaps need attention before Review.
- **pass** — Every criterion has evidence, every lens that ran produced `pass | skipped`, no failures remain.

Confidence:

- **high** — Every criterion has evidence from a lens that actually exercised it (not just "tests pass" inferred coverage)
- **medium** — Most criteria have direct evidence, but one or two rely on indirect inference (e.g., a criterion implied by another passing test)
- **low** — Several criteria are unmet, or evidence is thin/indirect. Flag this prominently — Review will need to weigh whether to proceed

When unsure between **pass** and **gaps_found**: ask the user. Memory note: during work-kit sessions, ask the user about meaningful decisions rather than picking silently.

## Phase 4 — Write the Final section

Append `### Test: Final` to state.md. **This is what the Review phase reads** — make it self-contained.

```markdown
### Test: Validate

**Verdict:** pass | gaps_found
**Criteria status:**
- Satisfied: <N> / <total>
- Gaps: <list of unsatisfied criteria — or "None">

**Confidence:** high | medium | low

**Gap details:**
- "<unsatisfied criterion>" — <why it's not met and what's needed>
- ... or "None"
```

```markdown
### Test: Final

**Verdict:** pass | gaps_found
**Suite status:** all passing | <N> failures
**Total tests:** <count> (passing: <N>, failing: <N>)

**Lenses run:** <Verify, E2E, Browser — or subset>
**Lenses skipped:** <list with reason — or "None">

**Criteria status:**
- Satisfied: <N> / <total>
- Gaps: <list — or "None">

**Confidence:** high | medium | low

**E2E results:** pass | fail | skipped (<N> specs, <N> new)
**Browser results:** pass | fail | skipped (<N> flows verified)

**Evidence summary:**
- <criterion> — <evidence type and location>
- ...

**Concerns (non-blocking):**
- <any caveats Review should know — or "None">
```

## Receipt

Write JSON to the `receiptPath` the orchestrator gave you (`.work-kit/receipts/test-validate.json`). The CLI derives the outcome from `verdict`: `"pass"` → `done`; `"fail"` or `"partial"` → `revise` (surfaces the failure to the user — there is no auto-loopback to Build for this step today, so the user reviews and decides).

```json
{
  "version": 1,
  "step": "test/validate",
  "timestamp": "<ISO 8601>",
  "criteria": [
    { "id": "C1", "status": "pass", "evidence": "tests/avatar.test.ts:42" },
    { "id": "C2", "status": "fail", "evidence": "browser: error on /profile" }
  ],
  "verdict": "fail",
  "confidence": "high"
}
```

`criteria[]` and `verdict` are required. `confidence` is optional. If a lens hit an actual error (not just an unmet criterion), set `"error": { ... }` instead — that maps to `needs_debug`.

## Outcome routing

- **pass** → Review phase
- **gaps_found** → still proceed to Review by default; Review's Resolve step will weigh the gaps against the diff and decide ship/no-ship. Only return `needs_debug` if a lens hit an actual error (not just an unmet criterion).

## Rules

- Every criterion needs concrete evidence, not "I think it works"
- Be honest about gaps — hiding them here means Review catches them later (or worse, they ship)
- If a criterion is genuinely not testable, explain why in **Gap details** — don't silently mark it satisfied
- Low confidence is a real signal, not a hedge — flag it prominently
- Criteria should not change during Validate — if a new criterion is discovered, note it in **Concerns** but don't add it to the checklist mid-validation
- Don't downgrade an Exercise lens's `fail` to `pass` in Final because "the failing test was unrelated" — escalate the disagreement, don't paper over it

## Anti-rationalization

| Excuse | Reality |
|--------|---------|
| "The test suite passing counts as evidence for all criteria" | A passing suite proves the tests pass, not that each criterion is met. Each criterion needs a specific pointer — "tests pass" is not a mapping. |
| "This criterion is obviously satisfied, no explicit evidence needed" | If it's obvious, it's easy to provide evidence. If you can't point to specific evidence, your confidence is based on assumption, not proof. |
| "Low confidence is fine because the tests pass" | Low confidence means you aren't sure the criterion is met. That's a signal to investigate, not to accept and move on. |
| "I'll mark gaps_found and let Review figure it out" | Validate produces the verdict and the evidence map. Review's Resolve weighs trade-offs — but only if you've handed it specific gaps with reasons. "Gaps exist" with no detail is useless to Review. |
