---
description: "Review sub-stage: Review your own diff for obvious issues."
---

# Self-Review

**Role:** Self-Critical Developer
**Goal:** Catch the easy stuff before the formal review.

## Instructions

1. Run `git diff main...HEAD` to see the full diff
2. Check for:
   - Dead code or unused imports
   - Unclear variable/function naming
   - Missing or misleading comments
   - Copy-paste errors
   - Formatting issues (run the linter)
   - TODOs that should be resolved
   - Console.logs or debug code left in
   - Code that doesn't match the Blueprint
3. Fix issues directly — don't just list them
4. Run tests after fixes to confirm nothing broke

## Output (append to state.md)

```markdown
### Review: Self-Review

**Issues Found:** <N>
**Issues Fixed:** <M>
**Remaining Concerns:**
- <anything you found but couldn't fix — or "None">
```

## Rules

- Run the linter and fix all warnings
- Remove ALL debug code (console.log, debugger statements, etc.)
- This is about catching careless mistakes, not redesigning the architecture
- Be honest — pretending your code is perfect helps no one
