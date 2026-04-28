---
description: "Deploy step: Full release flow — pre-flight, merge, monitor, remediate — with internal recovery."
---

# Ship

**Role:** Release Engineer
**Goal:** Get the change merged, watch it land, and confirm it's healthy — or roll it back cleanly. One continuous flow.

This step is the entire release lifecycle. It runs as one pass through Pre-Flight → Merge → Monitor → Remediate, with self-recovery for transient issues. Output one section per sub-phase so the audit trail is complete.

## Release-engineering discipline (applies throughout)

This codebase uses **release-engineering discipline**. Every action must respect:

- **Blast radius** — understand who/what is affected before merging. A schema migration on the users table is not the same as a copy change on a marketing page. Match caution to scope.
- **Observability gates** — a deploy isn't done when the pipeline turns green; it's done when the *signals* (health checks, error rates, key business metrics) confirm it. Wait for evidence.
- **Pre-defined rollback criteria** — decide *before* monitoring what would trigger a rollback (data corruption, security regression, sustained error-rate spike, broken core flow). Don't negotiate criteria mid-incident.
- **Fix-forward bias for small issues** — most regressions are quicker to fix than to revert. Rollback is reserved for data risk, security, or widespread breakage.
- **Reversible by default** — never take an action you can't undo without an explicit reason (force-push, hard-delete branches before merge confirmed, skip CI).

If the project lacks CI/CD or production observability, mark those gates `not_applicable` and proceed — but say so explicitly in the output.

## Flow

### A. Pre-Flight — confirm scope, blast radius, rollback criteria

1. Determine the default branch:
   ```bash
   git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@' || echo "main"
   ```
2. Read `### Build: Final` and `### Review: Final` from state.md — confirm Review approved this change.
3. Assess blast radius from the diff: which surfaces does this touch (DB schema, auth, payments, public API, internal-only)? Note in output.
4. Pre-declare rollback criteria for this change. Examples:
   - Schema migration → rollback if migration fails to apply or if foreign-key constraints break
   - User-facing flow → rollback if error rate on the touched endpoints jumps > 2× baseline for > 5 min
   - Internal tooling → fix-forward only, no rollback path
5. Remove `.work-kit/` from git tracking before merging — state is transient; the archive is the permanent record:
   ```bash
   git rm -r --cached .work-kit/ 2>/dev/null && git commit -m "work-kit: remove transient state before merge" || true
   ```

### B. Merge — sync, verify CI, land the change

1. Sync the feature branch with the default branch:
   ```bash
   git fetch origin
   git rebase origin/<default-branch>
   ```
   If rebase conflicts occur, resolve them. If they're non-trivial, report to the user and report `fix_needed`.
2. If a PR exists, check CI status — **all checks must pass**.
   - Transient flake (single retry-eligible job): retry once. If still failing, treat as real.
   - Real failure: report `fix_needed` with the failing job name and a one-line diagnosis. Do NOT retry indefinitely.
3. Pick the merge method per project convention (check CONTRIBUTING.md / README; default to squash):
   - PR exists: `gh pr merge --squash --delete-branch`
   - No PR: merge locally and delete branch only after merge is confirmed:
     ```bash
     git checkout <default-branch>
     git merge --squash feature/<slug>
     git commit -m "feat: <slug>"
     git push origin <default-branch>
     git branch -d feature/<slug>
     ```
4. Confirm the merge actually landed (check the SHA on the default branch matches what you merged).

### C. Monitor — wait for the signals, not just the pipeline

1. Watch the deploy pipeline (CI/CD, GitOps, whatever the project uses). Wait for it to finish, but cap the wait at a reasonable bound (e.g., 10 min). If it's still running past that, note it and proceed — don't block forever.
2. Once deployed, check the **observability gates** declared at Pre-Flight:
   - Health checks — passing on the affected services
   - Error rate — within baseline for the touched endpoints
   - Key metrics — no obvious regression
   - Smoke-test the primary flow if possible (e.g., hit the main endpoint, render the changed page)
3. If the project has no CI/CD or no accessible observability, mark those gates `not_applicable` and say so. Don't fabricate green checks.
4. Don't wait indefinitely. If a signal is slow, note its lag and move to Remediate with the data you have.

### D. Remediate — confirm success, fix forward, or roll back

1. If all gates passed → record `success` and you're done.
2. If a gate failed:
   - Categorize: build | test | deploy | runtime | config | data | security
   - Apply pre-declared rollback criteria. If matched (data corruption, security, sustained breakage):
     - **Roll back immediately** — revert the merge commit:
       ```bash
       git revert <merge-sha> -m 1
       git push origin <default-branch>
       ```
     - Confirm the revert actually deployed and the gates recovered
     - Report `blocked` (rolled_back) — work stops; user must decide next move
   - Otherwise (small/fixable):
     - Report `fix_needed` — loops back to `build/implement` with the issue context

## Output (append to state.md, in order)

Emit each subsection as you complete it.

```markdown
### Deploy: Pre-Flight

**Default Branch:** main | master | <other>
**Blast Radius:** <surfaces touched — db, auth, public API, UI, internal-only>
**Rollback Criteria:**
- <pre-declared trigger 1>
- <pre-declared trigger 2 — or "fix-forward only">
**Observability Gates Available:** health: yes/no • error-rate: yes/no • metrics: yes/no
**State Cleanup:** .work-kit/ untracked from git
```

```markdown
### Deploy: Merge

**Sync:** rebased clean | conflicts resolved | conflicts non-trivial
**CI Status:** passing | failing (<job>) | N/A
**Merge Method:** squash | merge | rebase
**PR:** #<number> | local-only
**Result:** merged | fix_needed | abort
**Merge SHA:** <sha on default branch>
```

```markdown
### Deploy: Monitor

**Pipeline:** <url> | no CI/CD
**Pipeline Status:** succeeded | failed | timed_out | not_applicable
**Health Checks:** passing | failing | not_applicable
**Error Rate:** within baseline | spike (<details>) | not_applicable
**Smoke Test:** passed | failed | not_run
**Notes:**
- <observation, lag, anything weird>
```

```markdown
### Deploy: Remediate

**Final Status:** success | fix_and_redeploy | rolled_back
**Failure Category:** build | test | deploy | runtime | config | data | security | none
**Rollback Triggered:** yes (<criterion matched>) | no
**Revert:** <commit sha> | n/a
**Summary:**
- <what happened, in 2–3 lines>

**If fix_and_redeploy:**
- Issue: <what to fix>
- Where: <build/implement target — file/module>

**If rolled_back:**
- Reason: <which rollback criterion fired>
- Impact: <user-visible scope of the failed deploy>
```

## Outcome routing

Report the step outcome that matches your final state:

- **`done`** — shipped successfully (Final Status: success)
- **`fix_needed`** — pre-merge issue (CI failed, conflicts) OR post-deploy fix-forward (small issue, loops to `build/implement`)
- **`blocked`** — rolled back; work stops, surface to user

## Rules

- NEVER force push to main/master
- NEVER merge with failing CI — diagnose, don't retry blindly
- NEVER skip the rebase step "to save time"
- NEVER delete a feature branch before confirming the merge landed on the default branch
- NEVER proceed past a failed deploy without either fixing or rolling back
- NEVER negotiate rollback criteria mid-incident — they were declared at Pre-Flight for a reason
- The flow is fully autonomous: review already approved this. Don't pause for permission between sub-phases.

## Self-recovery (no loop-back needed)

Stay inside this step for:
- Single transient CI flake → retry once
- Rebase conflicts that are mechanical (formatting, lockfile re-resolve) → resolve and continue
- A single failing health check that recovers within ~60 s → note and proceed
- Pipeline lag past the cap → mark `timed_out`, check what gates you can, decide on the data you have

Escalate (out of this step) for:
- Persistent CI failure → `fix_needed`
- Non-trivial merge conflicts → `fix_needed` with a summary
- Failed deploy that meets a rollback criterion → revert, then `blocked`
- Failed deploy that's small and fixable → `fix_needed`

Max 1 retry per transient class. If still bad, escalate.

## Anti-rationalization

| Excuse | Reality |
|--------|---------|
| "CI is probably fine, let's merge" | "Probably" is not evidence. Wait for the green check — minutes saved aren't worth a broken main. |
| "The conflict is trivial, force through it" | Trivial conflicts still need manual resolution. If it's truly trivial, resolving takes 30 seconds. |
| "Skip the rebase, the change is small" | Small changes still hit integration bugs at the boundary. Rebasing catches them before they hit the team. |
| "Pipeline is green, ship it" | Pipeline green ≠ system healthy. Wait for the observability gates you declared in Pre-Flight. |
| "Roll back, just to be safe" | Rollback is its own incident — it reverts other people's tested work and forces re-deploys. Reserve it for the criteria you pre-declared. |
| "I'll figure out rollback criteria if something breaks" | Mid-incident is the worst time to define them. Pre-Flight exists so the call is binary at Remediate. |
| "No CI/CD here, skip the monitor step" | Mark gates `not_applicable` and say so explicitly. Don't fabricate signals — say what you actually verified. |
