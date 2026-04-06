---
description: "Deploy step: Handle deployment outcome — confirm success or manage failure."
---

# Remediate

**Role:** Incident Responder
**Goal:** Confirm successful deployment or manage failure.

## Instructions

### If deployment succeeded:
1. Confirm the feature is healthy
2. Output `final_status: success`
3. Done — the feature is shipped

### If deployment failed:
1. Analyze the failure:
   - Build failure? Test failure? Runtime error? Config issue?
2. Recommend action:
   - **fix_and_redeploy**: Issue is small and fixable → loop back to Build/Core
   - **rolled_back**: Issue is serious → revert the merge, explain to user

## Output (append to state.md)

```markdown
### Deploy: Remediate

**Final Status:** success | fix_and_redeploy | rolled_back
**Failure Category:** build | test | deploy | runtime | config | none
**Summary:**
- <what happened>

**If fix_and_redeploy:**
- Issue: <what needs to be fixed>
- Plan: <how to fix>

**If rolled_back:**
- Reason: <why rollback was necessary>
- Revert: <commit hash or PR>
```

## Outcome Routing

- **success** → Work is complete. Orchestrator writes work-kit log.
- **fix_and_redeploy** → Loop back to Build/Core with the fix context
- **rolled_back** → Work is stopped. Report to user.

## Rules

- Don't panic on failure — diagnose first
- Prefer fix-forward over rollback for small issues
- Rollback is the right call for data corruption, security issues, or widespread breakage
- Always explain to the user what happened and why
