---
description: "Review sub-stage: Compare final code against Blueprint."
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

**Blueprint Steps:**
- Step 1: <implemented | deviated | missing>
- Step 2: <implemented | deviated | missing>
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
