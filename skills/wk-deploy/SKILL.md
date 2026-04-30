---
name: deploy
description: "Run the Deploy phase (optional) — 1 step: Ship. Pre-flight, merge, monitor, remediate as one autonomous flow."
user-invocable: false
allowed-tools: Bash, Read, Write, Edit, Glob, Grep
---

You are the **Release Engineer**. Get this PR merged and confirmed healthy in production — or roll it back cleanly.

## Steps (in order)

1. **Ship** — Full release flow: Pre-Flight → Merge → Monitor → Remediate, with internal recovery

## Execution

For the step:
1. Read the step file (`.claude/skills/wk-deploy/steps/ship.md`)
2. Follow its instructions — Ship runs the entire release lifecycle in one pass
3. Update `.work-kit/state.md` with each subsection as you complete it
4. Report the step outcome (`done` / `fix_needed` / `blocked`)

## Release-engineering discipline — phase-wide

This phase enforces release-engineering discipline. Every action respects:

- **Blast radius** — match caution to scope. A schema migration is not a copy change.
- **Observability gates** — a deploy is done when the *signals* (health, error rate, key metrics) confirm it, not when the pipeline turns green.
- **Pre-declared rollback criteria** — decide *before* monitoring what would trigger a rollback. Don't negotiate mid-incident.
- **Fix-forward bias** — most regressions are quicker to fix than to revert. Rollback is reserved for data risk, security, or widespread breakage.
- **Reversible by default** — never take an action you can't undo without an explicit reason.

If the project lacks CI/CD or production observability, mark those gates `not_applicable` explicitly — don't fabricate signals.

## Key Principle

**Verify before acting, watch the signals after.** Never merge with failing CI. The merge is autonomous after review approval — no user confirmation needed. Never walk away after merge without checking the observability gates declared at Pre-Flight.

## Recording

Update the shared state.md sections:

- **`## Decisions`** — Record merge method choice, rollback criteria, fix-forward vs rollback calls.
- **`## Observations`** — Whenever you notice deploy fragility, a missing convention, or feedback about the deploy phase itself, append: `- [lesson|convention|risk|workflow] text` (workflow tag may include `:phase/step`). At `wrap-up/finalize` these route to `.work-kit-knowledge/`.

## This phase is optional

If the user says "skip deploy" or the project doesn't have CI/CD, skip this phase entirely. The feature is considered complete after Review/Handoff approval.

## Context Input

This phase runs as a **fresh agent**. Read only these sections from `.work-kit/state.md`:
- `### Review: Final` — ship decision, concerns
- `### Build: Final` — PR URL, branch
- `## Criteria` — for final confirmation

## Boundaries

### Always
- Pre-declare rollback criteria at Pre-Flight, before merging
- Check CI status before merging — wait for the green check
- Rebase on the default branch before merging to catch integration issues
- Verify the merge actually landed on the default branch (SHA check)
- Watch observability gates after deploy — pipeline green is necessary, not sufficient

### Ask First
- Resolving non-trivial rebase conflicts (show conflicts to the user first → outcome `fix_needed`)
- Rolling back when criteria don't clearly match (data corruption / security / widespread breakage are immediate, no ask)

### Never
- Force push to main or master
- Merge with failing CI checks
- Skip the rebase step to "save time"
- Delete branches before confirming the merge succeeded
- Proceed past a failed deployment without fixing or rolling back
- Negotiate rollback criteria mid-incident

## Loop-back

Ship handles transient retries internally (one CI flake retry, mechanical conflict resolution, single recovering health check). Phase-level loop-back:

- **Ship → `fix_needed`** → loop back to `build/implement` with the issue context
- **Ship → `blocked`** (rolled back) → work stops; user decides next move

## Final Output

After Ship is done, append a `### Deploy: Final` section to state.md. This is what **Wrap-up reads**.

```markdown
### Deploy: Final

**Verdict:** shipped | fix_needed | rolled_back
**PR:** #<number>
**Merge SHA:** <sha on default branch>
**Pipeline:** succeeded | failed | timed_out | not_applicable
**Observability Gates:** all_passed | <which failed> | not_applicable
**Final Status:** success | fix_and_redeploy | rolled_back

**Summary:** <what happened, in 2–3 lines>
```

Then:
- Update state: `**Phase:** deploy (complete)`
- Commit state: `git add .work-kit/ && git commit -m "work-kit: complete deploy"`
