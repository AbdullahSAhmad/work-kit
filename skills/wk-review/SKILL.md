---
name: review
description: "Run the Review phase — 7 steps: Triage, 4 parallel reviewers, Fix, Handoff."
user-invocable: false
allowed-tools: Bash, Read, Write, Edit, Glob, Grep, Agent
---

You are the **Senior Reviewer**. Perform multi-dimensional code review before the feature ships.

## Steps (in order)

1. **Triage** — Classify diff, decide which reviewers to spawn, extract scope boundaries
2. **Self-Review** — Check your own diff for obvious issues
3. **Security** — OWASP top 10 security review (if Triage says to run it)
4. **Performance** — Query efficiency, bundle size, rendering performance (if Triage says to run it)
5. **Compliance** — Compare final code against Blueprint (if Triage says to run it)
6. **Fix** — Aggressively fix all findings from reviewers
7. **Handoff** — Finalize PR description, flag concerns, make ship/no-ship decision

## Execution

1. Run **Triage** first (sequential) — it decides which reviewers are needed and extracts scope boundaries
2. Spawn the reviewers Triage selected as **parallel sub-agents**, passing each the scope boundaries
3. After all reviewers complete, run **Fix** (sequential) — reads all findings, fixes aggressively
4. Run **Handoff** (sequential) — makes the ship decision based on post-fix state

## Key Principle

**Reviewers report, Fix resolves.** The 4 parallel reviewers focus purely on finding issues — they do NOT fix code. All fixing is consolidated in the Fix step, which reads every finding and resolves them in a single pass. This avoids duplicate fix attempts and conflicting edits across parallel agents.

## Recording

Throughout every step, update the shared state.md sections:

- **`## Decisions`** — If you make judgment calls during review (e.g., "accepted this deviation because..."), record them.
- **`## Deviations`** — Compliance step will audit these. If you fix a deviation during review, note that it was resolved.
- **`## Observations`** — Whenever you spot a fragile area, a missing convention, or feedback about the review phase itself, append: `- [lesson|convention|risk|workflow] text` (workflow tag may include `:phase/step`). At `wrap-up/knowledge` these are routed to `.work-kit-knowledge/` so future sessions benefit.

Review findings feed directly into the Handoff decision and the final work-kit log.

## Context Input

This phase runs as a **fresh agent** (the orchestrator). Read only these sections from `.work-kit/state.md`:
- `### Plan: Final` — Blueprint (for Compliance review)
- `### Build: Final` — what was built, PR, deviations
- `### Test: Final` — test results, criteria status, confidence
- `## Criteria` — acceptance criteria

## Execution Flow

```
Triage (sequential)
  ↓ decides which reviewers + extracts scope boundaries
  ↓
Agent: Self-Review  ──┐
Agent: Security*    ──┤  (* only if Triage selected)
Agent: Performance* ──├──→ Fix (sequential) ──→ Handoff (sequential)
Agent: Compliance*  ──┘
```

**Triage** runs first. It classifies the diff (trivial/small/medium/large), decides which of the 4 reviewers are relevant, and extracts scope boundaries from the Blueprint (items explicitly out of scope or deferred).

Each sub-agent receives:
- The git diff (`git diff main...HEAD`)
- The relevant Context Input sections
- Its step skill file instructions
- **Scope boundaries from Triage** — items to NOT flag as issues

Each writes its own `### Review: <step>` section to state.md.

**Fix agent** reads all review sections, aggressively fixes everything fixable (default: FIX, not SKIP).

**Handoff agent** reads all review sections + Fix results + Test: Final → makes the ship decision.

## Boundaries

### Always
- Read the full git diff before making any review judgments
- Do not fix code during the 4 parallel reviews — report only (Fix step handles all fixes)
- Run the test suite after the Fix step to confirm nothing broke
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
- Skip Triage (it gates everything else)
- Skip Self-Review (always runs regardless of Triage category)
- Flag out-of-scope items as issues (respect Blueprint boundaries)

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
