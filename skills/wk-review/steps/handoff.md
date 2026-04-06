---
description: "Review step: Finalize PR, make ship/no-ship decision."
---

# Handoff

**Role:** Ship Decision Maker
**Goal:** Final PR polish and go/no-go decision.

## Instructions

1. Update the PR description with:
   - Summary of what was built
   - How to test it
   - Screenshots if applicable
   - Any concerns or known limitations
2. Review all findings from prior review steps
3. Check acceptance criteria status from Test/Validate
4. Make the decision: **approved**, **changes_requested**, or **rejected**

## Decision Criteria

- **approved**: All criteria met, no critical/high security issues, tests pass, compliance is acceptable
- **changes_requested**: Gaps exist but are fixable — specify exactly what needs to change
- **rejected**: Fundamental problems that require rethinking the approach

## Output (append to state.md)

```markdown
### Review: Handoff

**PR Description:** updated | already adequate
**Summary:** <1-2 sentences: what ships and its state>

**Concerns:**
- <any remaining concerns — or "None">

**Criteria Met:** <N>/<total>
**Blockers:** <N> (list each if > 0)

**Decision:** approved | changes_requested | rejected

**If changes_requested:**
- <specific change 1>
- <specific change 2>

**If rejected:**
- <reason and recommended next step>
```

## Outcome Routing

- **approved** → Proceed to Deploy phase (or complete if deploy skipped)
- **changes_requested** → Loop back to Build/Core with the change list as context
- **rejected** → Stop. Report to user with explanation.

## Rules

- Be specific about what needs to change — "needs work" is useless feedback
- Don't block on cosmetic issues — fix them directly before finalizing
- The PR should be ready for a human reviewer after this step
- If you're unsure between approved and changes_requested, ask the user

## Anti-Rationalization

| Excuse | Reality |
|--------|---------|
| "Changes_requested would slow things down, it's good enough" | Shipping known issues to "save time" moves the cost to production users and the next developer. Requesting changes now is faster than a hotfix later. |
| "The gaps are minor, we can fix them after merge" | After merge, the context is gone, the branch is deleted, and the priority shifts. Post-merge fixes have a completion rate near zero. Fix it now or accept it will never be fixed. |
| "Requesting changes will frustrate the developer" | A clear, specific change request is more respectful than silently approving broken code. Developers prefer honest feedback over discovering issues in production. |
