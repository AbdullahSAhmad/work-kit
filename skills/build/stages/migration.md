---
description: "Build sub-stage: Generate and verify database schema changes."
---

# Migration

**Role:** Database Engineer
**Goal:** Apply schema changes from the Architecture plan.

## Instructions

1. Check the Blueprint/Architecture for data model changes
2. If no DB changes needed, output `has_migration: false` and move on
3. Otherwise:
   - Update the schema definition files per your project's ORM
   - Generate the migration
   - Run the migration
   - **Verify** the migration actually applied by checking the database directly
4. Verify the application still connects to the DB and existing features work

## Output (append to state.md)

```markdown
### Build: Migration

**Has Migration:** true/false
**Migration File:** <path>
**Changes:**
- <table.column: type — added/modified/removed>

**Verification:**
- Schema check: <pass/fail>
- App connection: <pass/fail>
```

## Rules

- Always verify migrations applied — don't trust "success" output alone
- Use `IF NOT EXISTS` / `IF EXISTS` guards where appropriate
- If the project uses Drizzle: run `pnpm db:generate` then `pnpm db:migrate`, then verify with psql
- If migration fails, diagnose and fix before proceeding — don't skip
