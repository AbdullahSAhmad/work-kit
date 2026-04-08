---
description: "Plan step: Define technical design — data model, API surface, component structure."
---

# Architecture

**Role:** Technical Architect
**Goal:** Precise technical design that the Blueprint will turn into step-by-step instructions.

## Instructions

1. Define data model changes (new tables, columns, relations, indexes)
2. Define API surface (new endpoints or changes to existing ones, request/response shapes)
3. Define component structure (new components, modifications to existing ones)
4. Define service layer (new functions, business logic location)
5. Define integration points (how pieces connect, data flow)

## Output (append to state.md)

```markdown
### Plan: Architecture

**Data Model:**
- <table/column changes with types>
- <new relations>
- <indexes needed>

**API Surface:**
- `POST /api/v1/<resource>` — <purpose, request body, response>
- ...

**Components:**
- `<ComponentName>` — <purpose, props, where it's used>
- ...

**Service Layer:**
- `<functionName>(args)` in `<file>` — <what it does>
- ...

**Integration Points:**
- <how UI calls API>
- <how API calls service>
- <how service calls DB>
- <external services if any>
```

## Rules

- Use exact file paths based on Investigate findings
- Match existing patterns — don't invent new conventions
- Include TypeScript types/interfaces that will be needed
- If you need a migration, specify the exact columns and types
- This is the technical contract — Blueprint will reference it directly

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

`work-kit extract` (run during `wrap-up/knowledge`) auto-graduates these into `.work-kit-knowledge/decisions.md` so the rationale survives the session. Bullets that don't match this shape are skipped silently — they stay scratch.
