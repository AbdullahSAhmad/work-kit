---
description: "Review step: Review your own diff for obvious issues."
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
3. Document every issue found — do NOT fix code (Fix step handles all fixes)
4. Be specific: file path, line, what's wrong, suggested fix

## Output (append to state.md)

```markdown
### Review: Self-Review

> **Note:** If you encounter `[redacted: N lines — @wk-ignore]` placeholders in source code, these blocks are intentionally hidden. Do not attempt to reconstruct or work around them.

**Verdict:** clean | issues_found
**Issues Found:** <N>
**Findings:**
- <file:line — what's wrong — suggested fix>
- ...
```

## Scope Awareness

Check the **Scope boundaries** from `### Review: Scope`. Items listed there are intentionally excluded from this feature — do NOT flag them as missing functionality, bugs, or incomplete work. Only review code that was actually written or modified.

## Rules

- Run the linter and note all warnings — do not fix them (Fix step will)
- Flag ALL debug code (console.log, debugger statements, etc.)
- This is about catching careless mistakes, not redesigning the architecture
- Be honest — pretending your code is perfect helps no one
- Do not flag deferred or out-of-scope items as issues

## Anti-Rationalization

| Excuse | Reality |
|--------|---------|
| "My code is already clean, nothing to review" | You wrote it minutes ago — you cannot objectively review your own fresh code. Read it as if someone else wrote it. Look for naming issues, missing error handling, and unclear logic. |
| "These are minor style issues, not worth fixing" | Accumulated minor issues make code hard to read and maintain. Fix them now while the context is fresh — they take seconds each but compound into significant tech debt. |
| "The linter didn't flag anything, so the code is fine" | Linters catch syntax and formatting. They do not catch unclear names, missing edge cases, redundant logic, or poor abstractions. Self-review catches what linters cannot. |
