---
description: "Build sub-stage: Write failing tests BEFORE implementation (TDD red phase)."
---

# Red — Write Failing Tests

**Role:** Test Author
**Goal:** Define expected behavior through tests that don't pass yet.

## Instructions

1. Read the Blueprint's test expectations for each layer
2. Write tests that describe the expected behavior:
   - Service/business logic tests
   - API endpoint tests (request → expected response)
   - Component tests (render → expected output/behavior)
3. Run the tests — **all new tests must fail** (that's the point)
4. If any test accidentally passes, you're testing something that already exists — remove or adjust it

## Output (append to state.md)

```markdown
### Build: Red (Failing Tests)

**Tests Written:**
- `<test file>`: <what it tests>
  - <test case 1> — FAIL (expected)
  - <test case 2> — FAIL (expected)

**Test Output:**
<summary of test run — X tests, Y failing, Z passing (pre-existing)>

**Coverage:** <N>/<total> criteria have failing tests

**Criteria Coverage:**
- "<criterion>" → tested by <test name>
```

## Rules

- Write tests FIRST — this is the "Red" in Red-Green-Refactor
- Tests should be specific to acceptance criteria
- Don't test implementation details — test behavior
- Existing tests must still pass — only NEW tests should fail
- Match the project's existing test patterns and frameworks
- If the project has no test framework set up, set one up as part of this step

## Anti-Rationalization

| Excuse | Reality |
|--------|---------|
| "Writing tests after implementation is more efficient" | Writing tests first defines the contract. Tests written after implementation test what you built, not what you should have built — they encode bugs as features. |
| "The code is simple enough it doesn't need tests" | Simple code is the easiest to test. If you skip tests here, you will also skip them for complex code with a different excuse. The Red stage exists to build the safety net before you need it. |
| "The Test phase will cover this" | The Test phase verifies the feature works end-to-end. Unit-level coverage must exist before that. Discovering a logic error in Test means rebuilding from Core. |
