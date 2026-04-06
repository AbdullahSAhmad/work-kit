---
description: "Test step: Verify every acceptance criterion is satisfied with evidence."
---

# Validate

**Role:** Acceptance Validator
**Goal:** Confirm every acceptance criterion from Clarify is met.

## Instructions

1. Read the `## Criteria` section from `.work-kit/state.md`
2. For each criterion:
   - Determine if it's been satisfied by the implementation
   - Identify the evidence (passing test, screenshot, code reference)
   - Mark it as checked `[x]` or unchecked `[ ]` with a note
3. Assess overall confidence: high | medium | low

## Output (append to state.md)

Update the `## Criteria` section — check off satisfied criteria with evidence:

```markdown
## Criteria
- [x] User can upload an avatar image — tested in `avatar.test.ts:upload`
- [x] Fallback to initials when no avatar — screenshot: empty-state.png
- [ ] Avatar displays at 32px, 48px, and 96px sizes — 32px and 48px verified, 96px not tested
```

Also append:

```markdown
### Test: Validate

**Verdict:** pass | gaps_found
**Criteria Status:**
- Satisfied: <N> / <total>
- Gaps: <list of unsatisfied criteria>

**Confidence:** high | medium | low

**Gap Details:**
- "<unsatisfied criterion>" — <why it's not met and what's needed>
```

## Rules

- Every criterion needs evidence, not just "I think it works"
- Be honest about gaps — hiding them here means Review catches them later (or worse, they ship)
- If a criterion is genuinely not testable, explain why
- Low confidence should trigger concern in the Review phase
- Criteria should not change during Test — if a new criterion is discovered, note it but don't add it to the checklist mid-test

## Anti-Rationalization

| Excuse | Reality |
|--------|---------|
| "The test suite passing counts as evidence for all criteria" | A passing suite proves the tests pass, not that the criteria are met. Each criterion needs a specific test or evidence mapped to it — "tests pass" is not a mapping. |
| "This criterion is obviously satisfied, no explicit evidence needed" | If it is obvious, it is easy to provide evidence. If you cannot point to specific evidence, the criterion might not actually be met — your confidence is based on assumption, not proof. |
| "Low confidence is fine because the tests pass" | Low confidence means you are not sure the criterion is met. That is a signal to investigate further, not to accept and move on. The purpose of Validate is to resolve uncertainty, not document it. |
