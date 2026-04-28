---
description: "Build step: Full TDD cycle — failing tests, domain code, UI, refactor, and integration wiring."
---

# Implement

**Role:** Lead Developer (Domain-Driven)
**Goal:** Turn the Blueprint into working code via a tight Red → Green → Refactor → Integrate loop, organized around the domain model.

This step is the entire TDD cycle plus integration. It runs as one continuous flow — keep going until the full data path works end-to-end with green tests. Output one section per phase of the cycle so reviewers can trace what happened.

## DDD discipline (applies throughout)

The codebase follows **Domain-Driven Design**. Every change must respect the model from Plan/Design:

- **Bounded contexts** are honored — code does not reach across context boundaries except through explicit anti-corruption layers
- **Aggregate roots** are the only entry points for mutating state inside their aggregate; child entities are not mutated directly from outside
- **Value objects** are immutable, equality-by-value, and validated in their constructor
- **Domain events** are emitted from aggregates, not from application services or controllers
- **Repositories** persist whole aggregates; no per-field queries that bypass the root
- **Application services** orchestrate use cases — they don't contain business rules
- **Ubiquitous language** from Plan/Understand is reflected in class, method, and variable names — no leaky technical names ("UserManager", "DataHandler") for domain concepts

If something feels awkward inside this discipline, that's usually a signal the model needs adjusting — record a Deviation and (if material) loop back to Plan/Design rather than smuggling business logic into the wrong layer.

## Cycle

### A. Red — failing tests first

1. Read the Blueprint's test expectations for each layer
2. Write tests that describe expected behavior **at the right DDD layer**:
   - Aggregate / domain logic tests (pure, no infra)
   - Application service tests (orchestration, often with in-memory repos)
   - API endpoint / adapter tests (request → response)
   - Component tests (render → output / interaction)
3. Run tests — **all new tests must fail**. If one passes, you're testing something that already exists; remove or sharpen it
4. Existing tests must still pass

### B. Core — make them green

1. Implement the **minimum** code to make failing tests pass, in this order:
   - **Domain layer**: aggregates, entities, value objects, domain events, domain services
   - **Application layer**: use-case services that orchestrate the domain
   - **Infrastructure layer**: repository implementations, adapters
   - **API layer**: route handlers, validation schemas
2. Match existing codebase patterns from Plan/Investigate — naming, file structure, error handling
3. Run tests after each layer — watch them go green

### C. UI (skip if `has_ui_changes: false` from UX Flow)

1. Implement components, pages, forms, navigation per the Blueprint
2. Wire UI to the **application services** built in Core — never directly to repositories or aggregates
3. Handle all states from UX Flow: default, loading, error, empty, success
4. Every interactive element defines all five states: `default`, `hover`, `focus-visible`, `active`, `disabled` (plus `loading` for async)
5. Every interactive element has `cursor: pointer`
6. No ad-hoc values — colors, spacing, font sizes, radii, shadows must come from the project's tokens/scale. No raw hex, no raw px in new component code
7. Mobile touch targets ≥ 44×44px
8. Use `focus-visible` (not `focus`) for keyboard focus rings
9. Don't introduce new UI libraries unless the Blueprint calls for it
10. Accessibility basics: labels, keyboard nav, ARIA where needed
11. Run any UI/component tests

### D. Refactor — clean while green

1. Confirm full test suite passes before starting
2. Look for: duplication that should extract into a domain concept (often a missing value object), unclear names that violate ubiquitous language, long functions, missing error handling at system boundaries, dead code, unused imports
3. Refactor incrementally — run tests after each change
4. If tests break: **stop immediately**, revert the breaking change, return to Core to diagnose
5. Don't refactor code you didn't write/modify in this feature
6. Don't add new features during refactor

### E. Integration — wire end-to-end

1. Trace every code path from user action → API → application service → aggregate → repository → DB → response → UI
2. Verify each boundary: type contracts match, validation lives at the right layer, errors surface correctly
3. Fix wiring issues (wrong imports, missing props, mismatched types)
4. Run the full test suite — confirm nothing broke
5. If the dev server is available, manually navigate the key flow

## Output (append to state.md, in order)

Emit each subsection as you complete it. They preserve backward-compat with downstream consumers.

```markdown
### Build: Red (Failing Tests)

**Tests Written:**
- `<test file>`: <what it tests> — <DDD layer: domain | application | adapter | UI>
  - <test case> — FAIL (expected)

**Test Output:** <X tests, Y failing as expected, Z pre-existing passing>
**Coverage:** <N>/<total> criteria have failing tests
**Criteria Coverage:**
- "<criterion>" → tested by <test name>
```

```markdown
### Build: Core

**Domain Layer:**
- `<Aggregate>` in `<path>` — <root, invariants enforced, events emitted>
- `<ValueObject>` in `<path>` — <validation rules>

**Application Layer:**
- `<UseCase>` in `<path>` — <orchestration>

**Infrastructure / API Layer:**
- `<Repository>` / `<Route>` in `<path>` — <what it does>

**Test Status:** previously failing=<N>, now passing=<M>, still failing=<K>

**Notes:**
- <deviations from Blueprint — also append to `## Deviations`>
```

```markdown
### Build: UI

**Components Created/Modified:**
- `<Component>` in `<path>` — <purpose>, wired to `<UseCase>`

**Pages Affected:**
- `<route>` — <what changed>

**States Handled:** loading: yes/no • error: yes/no • empty: yes/no

**Notes:**
- <deviations from UX Flow and why>
```

```markdown
### Build: Refactor

**Refactoring Summary:**
- <what was improved — extract value object, rename to ubiquitous term, etc.>

**Changes Made:** <N> files touched
**Tests:** before=<N> passing, after=<N> passing
**Test Status:** passing | broken (then revert + return to Core)
```

```markdown
### Build: Integration

**Integration Points Verified:**
- <flow>: working | fixed (<what was wrong>)

**Issues Fixed:**
- <issue and fix — or "None">

**Full Test Suite:** passing | failing (<details>)
```

## Rules

- Write tests **first** — Red before Core, every time
- Domain code has **no** infrastructure imports (no DB clients, no HTTP libs in aggregates/entities/VOs)
- Application services have **no** business rules — only orchestration
- UI talks to application services, never to repositories or aggregates directly
- Match existing codebase patterns exactly — naming, file structure, error handling
- Match the project's existing design system / component patterns
- Tests must be green before AND after refactoring
- Don't introduce new UI libraries unless the Blueprint calls for it
- If you encounter `[redacted: N lines — @wk-ignore]` placeholders, leave them alone — don't reconstruct or work around them

## Self-recovery (no loop-back needed)

If Refactor breaks tests: revert the offending change, fix in Core, re-run Refactor. Stay inside this step. Max 2 attempts; if still broken, escalate by completing the step with `verdict: complete_with_issues` and let Test catch it.

## Anti-rationalization

| Excuse | Reality |
|--------|---------|
| "Writing tests after is more efficient" | Tests written after encode whatever you happened to build, including the bugs. Red defines the contract. |
| "This logic is fine in the application service" | If it enforces an invariant on domain state, it belongs in the aggregate. Putting it in the service splits the rule across files and lets future callers bypass it. |
| "I'll skip the value object — a string is fine" | A bare `string` for an EmailAddress invites every caller to validate (or forget to). One value object centralizes the rule. |
| "The Blueprint approach won't work, let me redesign" | Adapt minimally and record a Deviation. If the model is truly wrong, return to Plan/Design — don't redesign mid-build. |
| "I should add this extra feature while I'm here" | Scope creep. Every addition not in the Blueprint is unreviewed. Add it as a follow-up. |
| "This pattern is better than what the codebase uses" | Consistency wins. Introduce new patterns in dedicated refactoring work. |
| "Unit tests passing means integration is fine" | Unit tests mock boundaries. Integration bugs live at the boundaries. |
| "The code is fine, nothing to refactor" | Read your own code as if reviewing a PR — fresh code always has cleanup opportunities. |
