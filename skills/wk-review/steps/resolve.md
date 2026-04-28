---
description: "Review step: Aggregate all findings, fix aggressively, finalize PR description, make ship/no-ship decision."
---

# Resolve

**Role:** Fix Engineer + Ship Decision Maker
**Goal:** Read every reviewer's findings, fix everything fixable, then make the call. Default is FIX. The bar for SKIP is high.

This step merges what was previously two steps (Fix and Handoff). Reviewers report; you resolve. One pass, one verdict.

## Phase 1 — Aggregate

1. Read these sections from `.work-kit/state.md`:
   - `### Review: Roundup` — total counts and skipped reviewers
   - `### Review: Quality`, `### Review: Efficiency`, `### Review: Security`, `### Review: Compliance` (whichever ran)
   - `### Test: Final` — current test/criteria status
   - `## Criteria` — acceptance criteria
2. Build a single ordered work-list of every finding, sorted by severity: critical → high → medium → low
3. Note critical/high security findings — they're blockers; if any cannot be fixed in this step, the verdict will be `changes_requested` or `rejected`

## Phase 2 — Fix loop

For each finding, apply the binary rule:

| Decision | When |
|----------|------|
| **FIX** (default) | The issue is in code we wrote/modified. Always fix unless the criteria below force SKIP. |
| **SKIP** | (a) the issue is in unrelated code outside the diff, **or** (b) it requires architectural redesign that belongs in a separate change, **or** (c) it's an explicitly deferred item per `### Review: Scope` boundaries. |

Then loop:

1. Pick the highest-severity unresolved finding
2. Make the change
3. Run the relevant test(s) for the changed file
4. If tests break, **revert that fix** and move it to SKIP with reason "broke <test>"
5. Update the originating `### Review: <Lens>` section: append `→ Fixed` to the resolved line
6. Continue until the work-list is empty

After the loop:
- Run the **full test suite** once
- Run the **linter** once
- If anything is now broken that wasn't before, diagnose and fix before proceeding

## Phase 3 — Finalize the PR

1. Update the PR description with:
   - **Summary** — what was built (1-2 sentences)
   - **How to test** — concrete steps a human can follow
   - **Screenshots** if UI changed
   - **Known limitations** — anything skipped, deferred, or noted as a remaining concern
2. Confirm the PR title is descriptive and matches the work
3. Verify acceptance criteria status from `### Test: Final` — count met / total

## Phase 4 — Ship decision

Apply these criteria in order:

- **rejected** — fundamental problems requiring rethinking the approach. Fix can't help. Examples: wrong abstraction, security model is broken, the change doesn't address the original ask.
- **changes_requested** — Fix loop couldn't resolve key issues. Critical/high findings remain. Test/Validate criteria are unmet. The gaps need Build-phase changes — be specific about what.
- **approved** — All criteria met (or the unmet ones are explicitly acceptable). No critical/high security findings remain. Tests pass. Compliance is acceptable. Most findings resolved.

When unsure between **approved** and **changes_requested**: ask the user. Memory note: during work-kit sessions, ask the user about meaningful decisions rather than picking silently.

## Output (append to state.md)

```markdown
### Review: Resolve

**Total findings:** <N>
**Fixed:** <M>
**Skipped:** <K>

**Fixes applied:**
- `<file>:<change>` — <what was fixed> — (originated in <lens>)

**Skipped items:**
- <severity> <item> — <reason: out-of-scope / unrelated-code / would-redesign / broke-test>

**Test suite after fixes:** passing | failing (<details>)
**Linter after fixes:** clean | warnings (<details>)

**PR description:** updated | already adequate
**Criteria met:** <N>/<total>
**Blockers remaining:** <count>

**Decision:** approved | changes_requested | rejected

**If changes_requested:**
- <specific change 1>
- <specific change 2>

**If rejected:**
- <reason and recommended next step>

**Concerns (non-blocking):**
- <any remaining concerns — or "None">
```

After this section, the phase agent writes the `### Review: Final` section per `SKILL.md`.

## Outcome routing

- **approved** → Deploy phase (or complete if deploy is skipped)
- **changes_requested** → Loop back to `build/implement` with the change list as context
- **rejected** → Stop. Report to user with explanation.

## Rules

- Default is FIX. You need a real reason to SKIP.
- "It's minor" is not a reason to skip — minor issues are the easiest to fix
- "It would take too long" is only valid if it genuinely requires architectural changes
- Don't introduce new code patterns while fixing — match what's already there
- If a security finding is critical/high and you can't fix it in-step, that's a blocker — say so prominently in the output
- Run tests after every fix, not just at the end
- Don't redesign during Resolve. Resolve fixes findings; it does not rewrite the architecture. Architectural problems → `changes_requested` or `rejected`.
- Be specific about `changes_requested` — "needs work" is useless feedback. Say what file, what change.

## Anti-rationalization

| Excuse | Reality |
|--------|---------|
| "These are just recommendations, not real issues" | Findings from focused review lenses are issues the code carries forever if not fixed now. The context is fresh — fix it. |
| "Fixing this might break something" | That's why you run tests after each fix. If it breaks, revert. The risk of fixing is bounded; the risk of shipping known issues is unbounded. |
| "The reviewer was being too strict" | The reviewer was doing its job. If a finding is genuinely wrong, SKIP it with a clear reason — but "too strict" is not that reason. |
| "Changes_requested would slow things down, it's good enough" | Shipping known issues moves the cost to production users and the next developer. A change request now is faster than a hotfix later. |
| "The gaps are minor, we can fix them after merge" | Post-merge fixes have a completion rate near zero. The branch is gone, the context is stale, the priority shifts. Fix it now or accept it will never be fixed. |
| "Requesting changes will frustrate the developer" | A clear, specific change request is more respectful than silently approving broken code. Honest feedback beats production discoveries. |
