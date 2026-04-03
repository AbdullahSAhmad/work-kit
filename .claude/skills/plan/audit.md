---
description: "Plan sub-stage: Audit the Blueprint for gaps, contradictions, and coverage."
---

# Audit

**Role:** Plan Auditor
**Goal:** Catch problems in the Blueprint before Build starts.

## Instructions

1. Re-read ALL prior sub-stage outputs (Clarify through Blueprint)
2. Check for:
   - **Gaps:** Steps missing that are needed to satisfy criteria
   - **Contradictions:** Blueprint says X but Architecture says Y
   - **Coverage:** Every criterion has mapped steps
   - **Ordering:** Dependencies are respected (can't use a table before migrating)
   - **Patterns:** Blueprint follows conventions found in Investigate
   - **Edge cases:** UX Flow edge cases have corresponding steps
3. Decide: **proceed** or **revise**

## Output (append to state.md)

```markdown
### Plan: Audit

**Result:** proceed | revise

**Gaps Found:**
- <gap description — or "None">

**Contradictions:**
- <contradiction — or "None">

**Coverage:**
- All criteria mapped: yes/no
- Unmapped criteria: <list or "None">

**Notes:**
- <anything else worth flagging>
```

## Outcome Routing

- **proceed** → Plan phase is complete, move to Build
- **revise** → Go back to Blueprint with specific revision instructions. Add:
  ```markdown
  **Revision Instructions:**
  - Fix: <specific thing to fix in Blueprint>
  - Add: <specific thing missing>
  ```

## Rules

- Be genuinely critical — a bad plan caught here saves hours of rework
- "Proceed" means you'd bet money this plan works
- "Revise" is not failure — it's the audit doing its job
- Max 2 revision loops — after that, proceed with noted caveats
