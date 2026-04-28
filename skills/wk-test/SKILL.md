---
name: test
description: "Run the Test phase — 2 steps: Exercise (3 parallel lens sub-agents) and Validate (criteria mapping + verdict)."
user-invocable: false
allowed-tools: Bash, Read, Write, Edit, Glob, Grep, Agent
---

You are the **QA Lead**. Two focused steps deliver multi-lens verification and a phase verdict.

## Steps (in order)

1. **Exercise** — Fan out 3 parallel lens sub-agents (Verify, E2E, Browser), each observe-only beyond regression fixes
2. **Validate** — Aggregate lens outputs, map every acceptance criterion to evidence, write `### Test: Final`

## Execution

For each step:
1. Read the step file (e.g., `.claude/skills/wk-test/steps/exercise.md`)
2. Follow its instructions completely
3. Write outputs to `.work-kit/state.md` under the sections that step defines
4. Update `**Phase:** test` and `**Step:** <current>` in state.md
5. Proceed to the next step

The Exercise step is **internally parallel**: it uses the Agent tool to launch 3 lens sub-agents in a single message. They run concurrently, each writes its own subsection, then the Exercise step agent appends a Roundup. This mirrors `simplify`-style fan-out — no framework parallel group needed.

## Lens discipline (applies inside Exercise)

The 3 lenses are specific, not vague. Every claim ("flow X works", "criterion Y satisfied") must point at concrete evidence: test name, screenshot path, console output, or network record. Each lens follows two rigorous principles:

- **Run, then fix regressions** — every lens runs its real harness against the running code. Fix regressions in implementation, not by disabling tests.
- **Observe, don't decide** — lenses report verdicts on what they exercised. They do NOT add missing features or rule on whether the feature is "done"; that's Validate's job.

## Lens-selection model

Exercise decides which lenses to run based on classification + tooling availability:

- **Verify** always runs — the unit/integration suite is the regression gate
- **E2E** runs if Playwright is installed AND the classification benefits from durable specs (large-feature, or feature with UI). Skips gracefully if Playwright is missing.
- **Browser** runs if Chrome DevTools MCP is available AND the work has a UI surface. Skips gracefully if MCP is missing.

If a lens is genuinely not applicable (e.g., backend-only refactor), Exercise lists it in **Lenses skipped** with the reason.

## Recording

Throughout every step, update the shared state.md sections:

- **`## Criteria`** — Validate checks off criteria with inline evidence: `- [x] <criterion> — <test name | screenshot path | flow verdict>`. Skip without evidence is `[ ]` plus a reason.
- **`## Decisions`** — Judgment calls during testing (e.g., "marked criterion X untestable because..."): `- **<context>**: chose <X> over <Y> — <one-sentence why>`. Skip obvious choices.
- **`## Observations`** — Whenever you spot a fragile area, a missing test pattern, or feedback about the test phase itself, append: `- [lesson|convention|risk|workflow] text` (workflow tag may include `:phase/step`). At `wrap-up/knowledge` these route to `.work-kit-knowledge/`.

The criteria checklist is copied directly into the final work-kit log. Make it accurate.

## Context Input

This phase runs as a **fresh agent** (the orchestrator). Read only these sections from `.work-kit/state.md`:
- `### Build: Final` — what was built, PR, test status, known issues
- `### Plan: Final` — Blueprint (to test against), Architecture, UX Flow
- `### Triage: Final` — classification (drives lens selection)
- `## Criteria` — acceptance criteria to validate

## Architecture

```
Exercise (sequential step that internally spawns up to 3 parallel sub-agents)
  ├─ Sub-agent: Verify   ─┐
  ├─ Sub-agent: E2E*     ─┤  (* if Playwright installed + classification opts in)
  └─ Sub-agent: Browser* ─┘  (* if MCP available + UI surface)
       ↓ all report to state.md
       ↓ Exercise appends Roundup
       ↓
Validate (sequential)
  ↓ aggregate lens outputs → criteria-evidence map → verdict → ### Test: Final
```

Each lens sub-agent receives:
- The relevant Build / Plan sections
- Its lens-specific instructions from `steps/exercise.md`
- The list of acceptance criteria it should help cover

Each writes its own `### Test: <Lens>` section to state.md. After all three return, Exercise appends `### Test: Roundup`.

## Boundaries

### Always
- Run the full unit suite, not just new tests
- Provide explicit evidence for every satisfied criterion (test name, screenshot, or code reference)
- Report honest confidence levels — do not inflate confidence
- Fix regressions immediately rather than documenting them for later
- Coordinate dev-server lifecycle when E2E and Browser both run (start once, share, don't kill mid-run)

### Ask First
- Marking a criterion as "not testable" (explain why and get confirmation)
- Changing or reinterpreting acceptance criteria discovered during testing
- Disabling or modifying pre-existing tests

### Never
- Skip failing tests or disable them to make the suite pass
- Claim a criterion is satisfied without specific evidence
- Write E2E specs that test implementation details rather than user behavior
- Add missing feature code during Test phase (lenses report gaps; Build implements them)
- Downgrade an Exercise lens's `fail` to `pass` in Final because "the failing test was unrelated"

## Final Output

After Validate completes, append a `### Test: Final` section to state.md. **This is what the Review phase reads.**

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

Then:
- Update state: `**Phase:** test (complete)`
- Commit state: `git add .work-kit/ && git commit -m "work-kit: complete test"`

## Routing

Validate's verdict determines what happens next:
- **pass** → proceed to Review
- **gaps_found** → proceed to Review with gaps surfaced; Review's Resolve weighs them against the diff and decides ship/no-ship. Only return `needs_debug` if a lens hit an actual error (not just an unmet criterion).
