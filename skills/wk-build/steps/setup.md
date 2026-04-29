---
description: "Build step: Branch, deps, scaffolds, and database migrations. No feature code yet."
---

# Setup

**Role:** Project Scaffolder + Database Engineer
**Goal:** Prepare the workspace AND apply schema changes — everything that has to land before implementation starts.

## Instructions

### 1. Workspace prep

1. Verify you're in the correct worktree on the feature branch
2. Install any new dependencies the Blueprint specifies
3. Create the new files/directories the Blueprint calls for as **empty scaffolds** (no logic — that's Implement)
4. Update config files if the Blueprint requires it
5. Verify the project still builds/compiles cleanly

### 2. Migrations (skip if `has_migration: false` in Blueprint)

1. Update the schema definition files per your project's ORM, **respecting the DDD aggregate boundaries from Plan/Design** — one aggregate root per transactional boundary, value objects inlined where the model says so
2. Generate the migration
3. Run the migration
4. **Verify** the migration actually applied by checking the database directly (don't trust "success" output alone)
5. Verify the application still connects to the DB and existing features still work

## Output (append to state.md)

Append both sections (the second only if migrations ran):

```markdown
### Build: Setup

**Branch:** feature/<slug> (confirmed)
**Dependencies Added:**
- <package> — <why>

**Files Created:**
- `<path>` — <scaffold for what>

**Config Changes:**
- `<file>` — <what changed>

**Build Status:** clean | issues (detail)
```

```markdown
### Build: Migration

**Has Migration:** true/false
**Migration File:** <path>
**Changes:**
- <table.column: type — added/modified/removed>

**Aggregate Mapping:**
- `<table>` → `<Aggregate>` (root | child of `<root>`)

**Verification:**
- Schema check: <pass/fail>
- App connection: <pass/fail>
```

## Receipt

Write JSON to the `receiptPath` the orchestrator gave you (`.work-kit/receipts/build-setup.json`). The CLI derives `done`.

```json
{
  "version": 1,
  "step": "build/setup",
  "timestamp": "<ISO 8601>",
  "branch": "feature/<slug>",
  "deps_installed": true,
  "migrations_applied": ["20260429_add_avatar_url.sql"]
}
```

All step-specific fields are optional — fill in what applies. `"error": { ... }` maps to `needs_debug`.

## Rules

- Do NOT write implementation code — just scaffolds and schema
- Do NOT write tests yet — that's Implement
- If a previous loop-back already did the setup, verify state and skip what's done
- Always verify migrations applied — don't trust the migrator's exit code alone
- Use `IF NOT EXISTS` / `IF EXISTS` guards where appropriate
- If the project uses Drizzle: run `pnpm db:generate` then `pnpm db:migrate`, then verify with psql
- If dependency installation or migration fails, diagnose the issue — don't proceed with broken state
- DDD discipline: one aggregate per transactional boundary; value objects don't get their own table unless multi-row by design
