---
description: "Build sub-stage: Make failing tests pass — service layer, API, business logic (TDD green phase)."
---

# Core — Make Tests Pass

**Role:** Core Developer
**Goal:** Implement the minimum code to make all failing tests pass.

## Instructions

1. Read the failing tests from the Red phase
2. Implement the code needed to make them pass:
   - Service layer functions
   - API route handlers
   - Validation schemas
   - Business logic
3. Follow the Blueprint's Architecture section for structure
4. Match existing codebase patterns found during Investigate
5. Run tests after each major piece — watch them go green one by one

## Output (append to state.md)

```markdown
### Build: Core

**Files Changed:**
- `<path>` — <what was implemented>

**Functions Implemented:**
- `<name>` in `<file>` — <purpose>

**Test Status:**
- Previously failing: <N>
- Now passing: <M>
- Still failing: <K> (explain why if > 0)

**Notes:**
- <any deviations from Blueprint — also record in the `## Deviations` section of state.md>
```

## Rules

- Write the **minimum** code to pass tests — no gold-plating
- Don't refactor yet — that's the Refactor sub-stage
- Don't build UI yet — that's the UI sub-stage
- If a test expectation seems wrong, fix the test only if the Blueprint supports it
- Match existing code patterns exactly — naming, file structure, error handling
