---
description: "Plan step: Produce a full ordered step-by-step implementation plan."
---

# Blueprint

**Role:** Implementation Planner
**Goal:** A precise, ordered, step-by-step plan that can be executed without ambiguity.

## Instructions

1. Synthesize ALL prior step outputs (Clarify → Architecture) into one executable plan
2. Order steps by dependency — what must be done first
3. Each step must specify:
   - What to do (create file, modify function, run command)
   - Where (exact file path)
   - Why (which requirement/criterion it satisfies)
4. Group steps logically (DB → Service → API → UI)
5. Include test expectations at each layer

## Output (append to state.md)

```markdown
### Plan: Blueprint

#### Phase: Database
1. Create migration for <table> — columns: <list with types>
2. Run migration and verify with psql

#### Phase: Service Layer
3. Create `<function>` in `<file>` — <what it does>
4. Add validation schema in `<file>`

#### Phase: API
5. Create route handler `<method> <path>` in `<file>`
6. Wire validation → service → response

#### Phase: UI
7. Create `<Component>` in `<file>` — <props, behavior>
8. Add to page `<path>` — <where in the layout>
9. Handle loading/error/empty states

#### Phase: Tests
10. Unit test for service function — <what to assert>
11. API test for endpoint — <what to assert>
12. Component test — <what to assert>

#### Acceptance Criteria Mapping
- Criterion "<text>" → satisfied by steps <N, M>
- ...
```

## Rules

- Every acceptance criterion must map to at least one step. If a criterion can't be mapped, it's a gap — flag it for Audit
- Every step must have an exact file path
- Steps should be small enough to implement in one focused session
- If a step is "update 5 files", break it into 5 steps
- The Blueprint is the contract — Build phase follows it literally
- Include commands to run (migrations, test commands) as steps

## Anti-Rationalization

| Excuse | Reality |
|--------|---------|
| "High-level steps are sufficient, exact paths aren't needed" | Vague steps like "update the API" become ambiguous during Build. Exact file paths eliminate guesswork and prevent the wrong file from being modified. |
| "The Architecture section already covers the implementation plan" | Architecture describes structure. Blueprint describes execution order. Without a step-by-step plan, the Build agent will invent its own order — often wrong. |
| "Adding more detail will just slow things down" | A detailed Blueprint is the single highest-leverage artifact in the entire pipeline. Every minute here saves ten in Build. |
