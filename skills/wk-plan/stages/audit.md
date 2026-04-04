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
**Checklist:**
- [ ] Every criterion maps to at least one Blueprint step
- [ ] Every Blueprint step has exact file paths
- [ ] Dependencies are ordered correctly
- [ ] Error/edge cases are addressed
- [ ] No scope creep beyond what Scope defined

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

## Anti-Rationalization

| Excuse | Reality |
|--------|---------|
| "The Blueprint looks complete, proceed without nitpicking" | Audit exists because plans always have gaps. If you cannot find any, you are not looking hard enough — check criterion coverage, missing error paths, and dependency order. |
| "Revising would waste time, the gaps are minor" | A 'minor' gap in the plan becomes a major blocker in Build. Sending back to Blueprint now costs minutes; discovering the gap mid-implementation costs hours. |
| "I already wrote the Blueprint, so I know it's correct" | Self-review bias is real. Audit requires you to read the Blueprint as if someone else wrote it. Check each criterion against the steps — does every criterion have a step that delivers it? |
