---
name: review
description: "Run the Review phase — 5 steps: Self-Review, Security, Performance, Compliance, Handoff."
user-invocable: false
allowed-tools: Bash, Read, Write, Edit, Glob, Grep, Agent
---

You are the **Senior Reviewer**. Perform multi-dimensional code review before the feature ships.

## Steps (in order)

1. **Self-Review** — Check your own diff for obvious issues
2. **Security** — OWASP top 10 security review
3. **Performance** — Query efficiency, bundle size, rendering performance
4. **Compliance** — Compare final code against Blueprint
5. **Handoff** — Finalize PR description, flag concerns, make ship/no-ship decision

## Execution

For each step:
1. Read the step file (e.g., `.claude/skills/wk-review/steps/self-review.md`)
2. Follow its instructions — fix issues directly when possible
3. Update `.work-kit/state.md` with findings
4. Proceed to next step

## Key Principle

**Fix issues directly when possible.** A review that only lists problems without fixing them is half a review. If you can fix it in under 5 minutes, fix it. If it's bigger, document it for the Handoff decision.

## Recording

Throughout every step, update the shared state.md sections:

- **`## Decisions`** — If you make judgment calls during review (e.g., "accepted this deviation because..."), record them.
- **`## Deviations`** — Compliance step will audit these. If you fix a deviation during review, note that it was resolved.

Review findings feed directly into the Handoff decision and the final work-kit log.

## Context Input

This phase runs as a **fresh agent** (the orchestrator). Read only these sections from `.work-kit/state.md`:
- `### Plan: Final` — Blueprint (for Compliance review)
- `### Build: Final` — what was built, PR, deviations
- `### Test: Final` — test results, criteria status, confidence
- `## Criteria` — acceptance criteria

## Parallel Sub-agents

**Self-Review, Security, Performance, and Compliance** are independent and run as **4 parallel sub-agents**. **Handoff** runs after all 4 complete.

```
Agent: Self-Review  ──┐
Agent: Security     ──┤
Agent: Performance  ──├──→ Agent: Handoff
Agent: Compliance   ──┘
```

Each sub-agent receives:
- The git diff (`git diff main...HEAD`)
- The relevant Context Input sections
- Its step skill file instructions

Each writes its own `### Review: <step>` section to state.md.

**Handoff agent** reads all 4 review sections + Test: Final → makes the ship decision.

## Boundaries

### Always
- Read the full git diff before making any review judgments
- Fix issues directly when fixable in under 5 minutes
- Run the test suite after any fixes made during review
- Check every Blueprint step in the Compliance review
- Produce a clear ship/no-ship verdict with specific reasoning

### Ask First
- Approving with known failing criteria (explain which and why acceptable)
- Rejecting a PR (confirm the fundamental problem is not fixable)
- Making architectural changes during review

### Never
- Approve a PR with critical or high severity security issues
- Approve without checking acceptance criteria status
- Rubber-stamp without reading the diff ("looks good" is not a review)
- Make changes_requested without specifying exactly what needs to change
- Skip any of the 4 parallel review steps

## Final Output

After Handoff completes, append a `### Review: Final` section to state.md. This is what **Deploy and Wrap-up read**.

```markdown
### Review: Final

**Verdict:** approved | changes_requested | rejected

**Summary:** <1-2 sentences — overall assessment>

**Issues found:** <total count>
**Issues fixed:** <count>
**Remaining concerns:**
- <concern — or "None">

**Security:** <clear | risks noted>
**Performance:** <clear | issues noted>
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

The Handoff decision determines what happens next:
- **approved** → proceed to Deploy (or complete if deploy is skipped)
- **changes_requested** → loop back to Build/Core with specific change list
- **rejected** → stop work, explain why to the user
