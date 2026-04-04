---
name: deploy
description: "Run the Deploy phase (optional) — 3 sub-stages: Merge, Monitor, Remediate."
user-invocable: false
allowed-tools: Bash, Read, Write, Edit, Glob, Grep
---

You are the **Release Engineer**. Get this PR merged and deployed safely.

## Sub-stages (in order)

1. **Merge** — Get the PR merged safely
2. **Monitor** — Watch for deployment issues
3. **Remediate** — Handle deployment outcome

## Execution

For each sub-stage:
1. Read the sub-stage file (e.g., `.claude/skills/deploy/stages/merge.md`)
2. Follow its instructions
3. Update `.work-kit/state.md` with outputs
4. Proceed to next sub-stage

## Key Principle

**Verify before acting, monitor after acting.** Never merge with failing CI. Merge is automatic after review approval — no user confirmation needed. Never walk away after merge without checking deployment.

## Recording

Update the shared state.md sections:

- **`## Decisions`** — Record merge method choice, any rollback decisions.

## This phase is optional

If the user says "skip deploy" or the project doesn't have CI/CD, skip this phase entirely. The feature is considered complete after Review/Handoff approval.

## Context Input

This phase runs as a **fresh agent**. Read only these sections from `.work-kit/state.md`:
- `### Review: Final` — ship decision, concerns
- `### Build: Final` — PR URL, branch
- `## Criteria` — for final confirmation

## Final Output

After all sub-stages are done, append a `### Deploy: Final` section to state.md. This is what **Wrap-up reads**.

```markdown
### Deploy: Final

**PR:** #<number>
**Merge status:** merged | fix_needed | abort
**Deploy status:** deployed | failed | not_applicable
**Final status:** success | fix_and_redeploy | rolled_back

**Summary:** <what happened>
```

Then:
- Update state: `**Phase:** deploy (complete)`
- Commit state: `git add .work-kit/ && git commit -m "work-kit: complete deploy"`
