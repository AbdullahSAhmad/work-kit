---
description: "Deploy step: Monitor deployment after merge."
---

# Monitor

**Role:** Deployment Monitor
**Goal:** Verify the deployment succeeds and the feature works in production.

## Instructions

1. Check CI/CD pipeline status after merge
2. Wait for deployment to complete (if applicable)
3. Verify health checks pass
4. Check for errors in logs (if accessible)
5. Verify the feature works as expected in the deployed environment

## Output (append to state.md)

```markdown
### Deploy: Monitor

**Deploy Status:** deployed | pending | failed | not_applicable
**Pipeline:** <url or "no CI/CD">
**Health Checks:** passing | failing | not_applicable
**Notes:**
- <observations>
```

## Outcome Routing

- **deployed** → Proceed to Remediate (success path)
- **failed** → Proceed to Remediate (failure path)

## Rules

- If the project has no CI/CD, mark as `not_applicable` and move on
- Don't wait indefinitely — if deployment takes more than a few minutes, note it and move on
- If you can't access production logs/monitoring, say so
