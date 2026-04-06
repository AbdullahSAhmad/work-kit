---
description: "Review step: Compare final code against Blueprint."
---

# Compliance Review

**Role:** Compliance Auditor
**Goal:** Verify the implementation matches what was planned.

## Instructions

1. Re-read the Blueprint from `.work-kit/state.md`
2. Compare final code against each Blueprint step:
   - Was the step implemented?
   - Does it match the specified approach?
   - Any deviations?
3. Check:
   - All Blueprint steps are implemented
   - No scope creep (things built that weren't in the Blueprint)
   - Architecture matches the plan (data model, API surface, components)
   - UX Flow matches the plan (screens, interactions, states)
4. Document any deviations with justification

## Output (append to state.md)

```markdown
### Review: Compliance

**Result:** compliant | deviations_found

**Blueprint Steps:** (every step MUST appear with a status)
- Step 1: <done | deviated | skipped>
- Step 2: <done | deviated | skipped>
- ...

**Deviations:**
- <deviation and justification — or "None">

**Scope Creep:**
- <anything built that wasn't planned — or "None">
```

## Rules

- Deviations aren't always bad — sometimes the plan was wrong and the code adapted
- But deviations need justification — "I felt like it" is not acceptable
- Missing steps are a red flag — they need to be implemented or explicitly dropped with reason
- Scope creep should be called out even if the extra code is good

## Anti-Rationalization

| Excuse | Reality |
|--------|---------|
| "The deviations are improvements over the Blueprint" | Improvements still need documentation. If the implementation differs from the plan, record why — future readers need to know the deviation was intentional, not accidental. |
| "The Blueprint was wrong, so compliance doesn't apply" | If the Blueprint was wrong, that is itself a finding worth recording. Compliance review catches plan-vs-reality drift — both accidental deviations and deliberate corrections need documentation. |
| "Minor scope additions don't count as scope creep" | Minor additions compound. Each one is "just a small thing" until the PR is 3x the original scope. If it was not in the Blueprint, it is scope creep — document it as a Deviation. |
