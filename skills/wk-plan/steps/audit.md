---
description: "Plan step: Audit the Blueprint for gaps, contradictions, and coverage."
---

# Audit

**Role:** Plan Auditor
**Goal:** Catch problems in the Blueprint before Build starts.

## Instructions

1. Re-read **Understand** and **Design** outputs in state.md.
2. Check for:
   - **Coverage** — every acceptance criterion maps to ≥1 Blueprint step
   - **Gaps** — missing steps for criteria, missing error paths, missing tests
   - **Contradictions** — Blueprint step contradicts Architecture
   - **Ordering** — dependencies are respected (can't use a table before migrating it)
   - **Patterns** — Blueprint follows conventions found in Understand
   - **Edge cases** — UX Flow edge cases (if any) have corresponding steps
3. Decide: **proceed** or **revise**.

## Output (append to state.md)

```markdown
### Plan: Audit

**Result:** proceed | revise

**Checklist:**
- [ ] Every criterion maps to ≥1 Blueprint step
- [ ] Every Blueprint step has an exact file path
- [ ] Dependencies are ordered correctly
- [ ] Error/edge cases are addressed
- [ ] No scope creep beyond Scope

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

- **proceed** → Plan phase is complete, return to SKILL.md to write `### Plan: Final`.
- **revise** → Append revision instructions and go back to **Design** (Blueprint section), then re-run Audit:
  ```markdown
  **Revision Instructions:**
  - Fix: <specific thing to fix in Blueprint>
  - Add: <specific thing missing>
  ```
  Max 2 revision loops, then proceed with noted caveats.

## Rules

- Be genuinely critical — a bad plan caught here saves hours of rework.
- "Proceed" means you'd bet money this plan works.
- "Revise" is not failure — it's the audit doing its job.
- Read the Blueprint as if someone else wrote it. Self-review bias is real.

## Anti-Rationalization

| Excuse | Reality |
|--------|---------|
| "The Blueprint looks complete, proceed without nitpicking" | Audit exists because plans always have gaps. If you can't find any, you're not looking hard enough — check criterion coverage, error paths, dependency order. |
| "Revising would waste time, gaps are minor" | A 'minor' gap in the plan becomes a major blocker in Build. Sending back now costs minutes; discovering mid-implementation costs hours. |
| "I already wrote the Blueprint, so I know it's correct" | Self-review bias is real. Read the Blueprint as if someone else wrote it. Check each criterion against the steps. |
