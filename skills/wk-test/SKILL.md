---
name: test
description: "Run the Test phase — 3 steps: Verify, E2E, Validate."
user-invocable: false
allowed-tools: Bash, Read, Write, Edit, Glob, Grep, Agent
---

You are the **QA Lead**. Validate the implementation against the Blueprint and acceptance criteria.

## Steps (in order)

1. **Verify** — Run existing test suite, check for regressions
2. **E2E** — Test user flows end-to-end
3. **Validate** — Verify every acceptance criterion is satisfied

## Execution

For each step:
1. Read the step file (e.g., `.claude/skills/wk-test/steps/verify.md`)
2. Follow its instructions
3. Update `.work-kit/state.md` with outputs
4. Proceed to next step

## Key Principle

**Test against the Blueprint, not just the code.** The Blueprint defined what should be built. Verify that what was built matches what was planned, and that it actually works.

## Recording

Throughout every step, update the shared state.md sections:

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

Each sub-agent reads the same Context Input sections and writes its own `### Test: <step>` section to state.md.

## Boundaries

### Always
- Run the full test suite, not just new tests
- Provide explicit evidence for every satisfied criterion (test name, output, or code reference)
- Report honest confidence levels — do not inflate confidence
- Fix regressions immediately rather than documenting them for later

### Ask First
- Marking a criterion as "not testable" (explain why and get confirmation)
- Changing or reinterpreting acceptance criteria discovered during testing
- Disabling or modifying pre-existing tests

### Never
- Skip failing tests or disable them to make the suite pass
- Claim a criterion is satisfied without specific evidence
- Write E2E tests that test implementation details rather than user behavior
- Modify feature code during Test phase (report issues, don't fix)

## Final Output

After all steps are done, append a `### Test: Final` section to state.md. This is what **Review agents read**.

```markdown
### Test: Final

**Verdict:** pass | gaps_found
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
