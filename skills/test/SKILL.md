---
description: "Run the Test phase — 3 sub-stages: Verify, E2E, Validate."
---

You are the **QA Lead**. Validate the implementation against the Blueprint and acceptance criteria.

## Sub-stages (in order)

1. **Verify** — Run existing test suite, check for regressions
2. **E2E** — Test user flows end-to-end
3. **Validate** — Verify every acceptance criterion is satisfied

## Execution

For each sub-stage:
1. Read the sub-stage file (e.g., `.claude/skills/test/stages/verify.md`)
2. Follow its instructions
3. Update `.work-kit/state.md` with outputs
4. Proceed to next sub-stage

## Key Principle

**Test against the Blueprint, not just the code.** The Blueprint defined what should be built. Verify that what was built matches what was planned, and that it actually works.

## Recording

Throughout every sub-stage, update the shared state.md sections:

- **`## Criteria`** — Check off criteria as they're verified. Add evidence inline: `- [x] <criterion> — verified by <test name / screenshot / manual check>`.
- **`## Decisions`** — If you discover a criterion is untestable or needs reinterpretation, record the decision and why.

The criteria checklist is copied directly into the final work-kit log. Make it accurate.

## Context Input

This phase runs as a **fresh agent**. Read only these sections from `.work-kit/state.md`:
- `### Build: Final` — what was built, PR, test status, known issues
- `### Plan: Final` — Blueprint (to test against) and Architecture
- `## Criteria` — acceptance criteria to validate

## Parallel Sub-agents

**Verify** and **E2E** are independent and can run as **parallel sub-agents**. **Validate** runs after both complete (it needs their results).

```
Agent: Verify  ──┐
                  ├──→ Agent: Validate
Agent: E2E    ──┘
```

Each sub-agent reads the same Context Input sections and writes its own `### Test: <sub-stage>` section to state.md.

## Final Output

After all sub-stages are done, append a `### Test: Final` section to state.md. This is what **Review agents read**.

```markdown
### Test: Final

**Suite status:** all passing | <N> failures
**Total tests:** <count> (passing: <N>, failing: <N>)

**Criteria status:**
- Satisfied: <N> / <total>
- Gaps: <list — or "None">

**Confidence:** high | medium | low

**E2E results:**
- <flow>: pass | fail
- ...

**Evidence summary:**
- <criterion> — <evidence type and location>
- ...
```

Then:
- Update state: `**Phase:** test (complete)`
- Commit state: `git add .work-kit/ && git commit -m "work-kit: complete test"`
