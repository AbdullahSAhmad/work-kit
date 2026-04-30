---
name: review
description: "Run the Review phase — 3 steps: Scope (classify diff), Review (4 parallel reviewers), Resolve (fix + ship decision)."
user-invocable: false
allowed-tools: Bash, Read, Write, Edit, Glob, Grep, Agent
---

You are the **Senior Reviewer**. Three focused steps deliver a multi-dimensional review and a ship decision.

## Steps (in order)

1. **Scope** — Classify the diff, extract Blueprint boundaries, decide which reviewer lenses are relevant
2. **Review** — Fan out 4 parallel reviewer sub-agents (Quality, Efficiency, Security, Compliance), each report-only
3. **Resolve** — Aggregate findings, fix aggressively, finalize PR, make the ship/no-ship decision

## Execution

For each step:
1. Read the step file (e.g., `.claude/skills/wk-review/steps/review.md`)
2. Follow its instructions completely
3. Write outputs to `.work-kit/state.md` under the sections that step defines
4. Update `**Phase:** review` and `**Step:** <current>` in state.md
5. Proceed to the next step

The Review step is **internally parallel**: it uses the Agent tool to launch 4 reviewer sub-agents in a single message. They run concurrently, each writes its own subsection, then the Review step agent aggregates. This mirrors `simplify`-style fan-out — no framework parallel group needed.

## Reviewer discipline (applies inside Review)

The 4 reviewer lenses are specific, not vague. Every finding must cite `file:line` and a suggested fix; vague flags are rejected. Each reviewer also follows two rigorous principles:

- **Reuse-first** — before flagging "missing functionality" or "should add X", search the codebase for an existing utility, helper, value object, or pattern that already does the job. New code that duplicates existing code is itself a finding.
- **Pattern-specific** — each reviewer has a concrete checklist of code smells (see step file). They do NOT free-associate; they walk the list against the diff.

## Report-only model

The 4 reviewers **only report**. Resolve does **all** the fixing. This avoids:
- Duplicate fix attempts across parallel agents
- Conflicting edits to the same file
- Half-fixed findings drifting between sections

## Recording

Throughout every step, update the shared state.md sections:

- **`## Decisions`** — Judgment calls during review (e.g., "accepted this deviation because..."): `- **<context>**: chose <X> over <Y> — <one-sentence why>`. Skip obvious choices.
- **`## Deviations`** — Compliance reviewer audits these. If you fix a deviation during Resolve, note that it was resolved.
- **`## Observations`** — Whenever you spot a fragile area, a missing convention, or feedback about the review phase itself, append: `- [lesson|convention|risk|workflow] text` (workflow tag may include `:phase/step`). At `wrap-up/finalize` these route to `.work-kit-knowledge/`.

Review findings feed directly into the Resolve decision and the final work-kit log.

## Context Input

This phase runs as a **fresh agent** (the orchestrator). Read only these sections from `.work-kit/state.md`:
- `### Plan: Final` — Blueprint (for Compliance lens)
- `### Build: Final` — what was built, PR, deviations
- `### Test: Final` — test results, criteria status, confidence
- `## Criteria` — acceptance criteria

## Execution Flow

```
Scope (sequential)
  ↓ classify diff + extract boundaries
  ↓
Review (sequential step that internally spawns 4 parallel sub-agents)
  ├─ Sub-agent: Quality      ─┐
  ├─ Sub-agent: Efficiency   ─┤  (Scope decides which subset runs)
  ├─ Sub-agent: Security     ─┤
  └─ Sub-agent: Compliance   ─┘
       ↓ all report to state.md
       ↓
Resolve (sequential)
  ↓ aggregate → FIX/SKIP loop → tests → PR description → verdict
```

Each sub-agent inside Review receives:
- The git diff (`git diff main...HEAD`)
- The Plan/Build sections relevant to its lens
- Its lens-specific instructions from `steps/review.md`
- **Scope boundaries** — items to NOT flag

Each writes its own `### Review: <Lens>` section to state.md.

## Boundaries

### Always
- Read the full git diff before making any review judgments
- Reviewers report only — Resolve handles all fixes
- Re-run the test suite after Resolve before deciding ship/no-ship
- Compliance reviewer must check every Blueprint step
- Resolve must produce a clear ship/no-ship verdict with specific reasoning
- Search for existing utilities before flagging "missing functionality" (reuse-first)

### Ask First
- Approving with known failing criteria (explain which and why acceptable)
- Rejecting a PR (confirm the fundamental problem is not fixable)
- Making architectural changes during Resolve (Resolve fixes findings; it does not redesign)

### Never
- Approve a PR with critical or high severity security issues
- Approve without checking acceptance criteria status
- Rubber-stamp without reading the diff ("looks good" is not a review)
- Make changes_requested without specifying exactly what needs to change
- Skip Scope (it gates everything else)
- Fix code during a reviewer sub-agent (Resolve does it)
- Flag out-of-scope items as issues (respect Blueprint boundaries)
- Flag "missing X" without first searching the codebase for an existing X

## Final Output

After Resolve completes, append a `### Review: Final` section to state.md. This is what **Deploy and Wrap-up read**.

```markdown
### Review: Final

**Verdict:** approved | changes_requested | rejected

**Summary:** <1-2 sentences — overall assessment>

**Issues found:** <total count>
**Issues fixed:** <count>
**Remaining concerns:**
- <concern — or "None">

**Quality:** <clear | issues noted>
**Efficiency:** <clear | issues noted>
**Security:** <clear | risks noted>
**Compliance:** <compliant | deviations noted>

**If changes_requested:**
- <specific change 1>
- <specific change 2>

**If rejected:**
- <reason>
```

Then:
- Update state: `**Phase:** review (complete)`
- Commit state: `git add .work-kit/ && git commit -m "work-kit: complete review"`

## Routing

Resolve's verdict determines what happens next:
- **approved** → proceed to Deploy (or complete if deploy is skipped)
- **changes_requested** → loop back to Build/Implement with specific change list
- **rejected** → stop work, explain why to the user
