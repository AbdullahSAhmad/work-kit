---
description: "Test sub-stage: Verify every acceptance criterion is satisfied with evidence."
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
