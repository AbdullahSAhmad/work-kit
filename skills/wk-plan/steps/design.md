---
description: "Plan step: Direction, scope, UX (if UI), architecture, and the ordered Blueprint."
---

# Design

**Role:** Solution Architect + Implementation Planner
**Goal:** Decide the direction, draw scope, design the technical contract, and produce an ordered Blueprint the Build agent can execute literally.

## Instructions (in order)

1. **Direction** — Sketch the chosen approach. If non-obvious, note 1-2 alternatives and why rejected. High-level only — no SQL, no function signatures yet.
2. **Scope** — In/out, complexity (small/medium/large/x-large), prerequisites, anything that should split into a separate work item. Be ruthless about what's *out*.
3. **UX Flow** — *Skip if backend-only* (write `**Has UI Changes:** false` and stop the section). Otherwise: user flow steps, screens, interactions, edge cases (empty/loading/error/permissions).
4. **Architecture** — Domain model first, then the supporting infrastructure. Use exact file paths from Understand. Match existing patterns.
   - **Domain model (DDD — required for every change)**: aggregates and their roots, child entities, value objects (immutable, validated), domain events emitted, invariants enforced by each aggregate, repository contracts (one per aggregate root), application services that orchestrate use cases. Reuse the ubiquitous language from Understand verbatim.
   - **Cross-context interactions**: if the work spans bounded contexts, define the anti-corruption layer or context-mapping pattern (open-host, customer-supplier, etc.).
   - **Data model**: tables, columns, types, relations, indexes — derived from the aggregates (one aggregate = one transactional boundary).
   - **API surface**: endpoints with request/response, pointing at application services (not directly at repositories or aggregates).
   - **Components**: props, where used, which application service they call.
   - **Integration points**: UI → API → application service → aggregate → repository → DB.
5. **Blueprint** — Ordered, executable steps. Each step: what, where (exact path), why (which criterion). Group by layer (DB → Service → API → UI → Tests). Map every acceptance criterion to ≥1 step.

## Output (append to state.md)

Five blocks (omit UX Flow body if backend-only):

```markdown
### Plan: Sketch

**Approach:** <1-2 paragraphs — chosen direction>
**Alternatives Considered:** <option A — why not> / <option B — why not> (skip if obvious)
**Rough Shape:**
- Create: <new files/components/tables>
- Modify: <existing files that change>
- Delete: <anything being removed>
**Open Risks:** <things that might not work as expected>

### Plan: Scope

**In Scope:** <what will be built>
**Out of Scope:** <what won't — and why>
**Complexity:** <small | medium | large | x-large>
**Updated Criteria:** <if new criteria emerged, update ## Criteria>
**Prerequisites:** <or "None">
**Separate Work Items:** <or "None">

### Plan: UX Flow

**Has UI Changes:** true | false   *(if false, write only this line)*
**User Flow:**
1. User navigates to <page>
2. User clicks <element>
3. System shows <response>
**Screens Affected:** <page/component> — <new/modified> — <what changes>
**Interactions:** <element>: default / hover / focus / active / disabled / loading
**Edge Cases:** Empty / Loading / Error / Permissions

### Plan: Architecture

**Domain Model (DDD):**
- **Aggregate:** `<Name>` (root)
  - **Invariants:** <rule the root enforces>
  - **Child entities:** `<Entity>` — <relationship>
  - **Value objects:** `<VO>` — <validation rule>
  - **Domain events:** `<EventName>` — emitted when <condition>
- **Repository contract:** `<RepoName>` — methods: `<save(agg)>`, `<findById(id)>`, ... (one per aggregate root, persists whole aggregate)
- **Application services / use cases:** `<UseCaseName>` in `<file>` — orchestrates: <load agg → mutate → persist>
- **Bounded context:** <name>
- **Cross-context:** <ACL / open-host / customer-supplier — or "None">

**Data Model:**
- <table/column changes with types> — backs `<Aggregate>`
- <relations, indexes>

**API Surface:**
- `<METHOD> <path>` — calls `<UseCase>` — <request body, response>

**Components:**
- `<ComponentName>` — <props, where used> — calls `<UseCase>`

**Integration Points:**
- UI → API → `<UseCase>` → `<Aggregate>` → `<Repo>` → DB
- <external services if any, with ACL location>

### Plan: Blueprint

#### Phase: Database
1. Create migration for <table> backing `<Aggregate>` — columns: <list with types>
2. Run migration, verify

#### Phase: Domain
N. Create `<ValueObject>` in `<file>` — validation rule
N. Create `<Aggregate>` in `<file>` — invariants, events emitted, child entities
N. Create `<DomainEvent>` in `<file>`

#### Phase: Application
N. Create `<UseCase>` in `<file>` — load → mutate → persist via `<Repo>`
N. Add input validation schema in `<file>` (DTO at the boundary)

#### Phase: Infrastructure
N. Implement `<Repository>` in `<file>` — persists `<Aggregate>` whole
N. Wire any external adapters / ACLs

#### Phase: API
N. Route handler `<METHOD> <path>` in `<file>` — calls `<UseCase>`

#### Phase: UI
N. Create `<Component>` in `<file>` — props, behavior, calls `<UseCase>`
N. Add to page `<path>` — <where in layout>
N. Handle loading/error/empty states

#### Phase: Tests
N. Domain test — assert invariant on `<Aggregate>`
N. Application test — `<UseCase>` with in-memory repo
N. API test for endpoint — request → response
N. Component test — <what to assert>

#### Acceptance Criteria Mapping
- "<criterion>" → satisfied by steps <N, M>
```

## Receipt

Write JSON to the `receiptPath` the orchestrator gave you (`.work-kit/receipts/plan-design.json`). The CLI validates this and derives `done`.

```json
{
  "version": 1,
  "step": "plan/design",
  "timestamp": "<ISO 8601>",
  "blueprint_section": "### Plan: Final"
}
```

`blueprint_section` points at the section in state.md that contains the final blueprint Build will execute. Add `"error": { ... }` to map to `needs_debug`.

## Rules

- **Direction first** — don't write SQL or function signatures in Direction.
- **Be ruthless on scope** — feature creep kills velocity. "Out of scope" is a decision, not a deferral — explain why.
- **Skip UX Flow body entirely if backend-only.**
- **Match existing patterns** from Understand. Don't invent new conventions.
- **Use exact file paths** in Architecture and Blueprint. "Update the API" is not a step.
- **A step that touches 5 files is 5 steps.** Steps must be small enough for one focused session.
- **Every acceptance criterion maps to ≥1 Blueprint step.** Unmapped = gap → flag for Audit.
- For schema changes, specify exact columns and types.
- The Blueprint is the contract — Build follows it literally.

### DDD discipline (project-wide)

- **Aggregate first** — every change starts with "what aggregate(s) does this touch?". If none exists, create one.
- **One aggregate per transactional boundary.** Don't span aggregates in one transaction; use domain events for cross-aggregate effects.
- **Invariants live in aggregates.** Application services orchestrate; they never enforce a business rule.
- **Repositories persist whole aggregates.** No per-field updates that bypass the root.
- **Value objects, not primitives**, for any concept the domain names (Email, Money, Slug, ...). Validation lives in the constructor.
- **Domain events** for anything outside the aggregate that needs to react.
- **UI calls application services** — never repositories or aggregates directly.
- **Reuse the ubiquitous language** from Understand verbatim in class, method, and event names.

## Recording Decisions

When you choose between real alternatives in this step (a library, a data shape, a layering choice), append a bullet to `## Decisions` in state.md using **this exact shape**:

```
- **<context>**: chose <X> over <Y> — <one-sentence why>
```

Examples:

```
- **State store**: chose Zustand over Redux Toolkit — smaller surface, no boilerplate, project already uses it elsewhere.
- **ID generation**: chose ULID over UUID v4 — sortable, K-ordered for index locality.
```

`work-kit extract` (run during `wrap-up/knowledge`) auto-graduates these into `.work-kit-knowledge/decisions.md`. Bullets that don't match this shape are skipped silently.

## Anti-Rationalization

| Excuse | Reality |
|--------|---------|
| "Approach is obvious, alternatives not needed" | Fine if genuinely obvious — but verify it really is, not just convenient. |
| "Everything is in scope" | Unbounded scope is how features balloon. Listing what's *out* prevents Build drift. |
| "This is too small to scope formally" | Small tasks with unclear boundaries grow silently. A 2-line scope section costs nothing. |
| "Architecture covers the implementation order" | Architecture = structure. Blueprint = execution order. Without ordered steps, Build invents its own — often wrong. |
| "High-level Blueprint steps are sufficient" | Vague steps become ambiguous in Build. Exact paths eliminate guesswork. |
| "Adding more detail will slow things down" | A detailed Blueprint is the highest-leverage artifact in the entire pipeline. Every minute here saves ten in Build. |
