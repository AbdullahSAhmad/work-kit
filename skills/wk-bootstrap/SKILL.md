---
name: bootstrap
description: "Session bootstrap — detect work-kit state and orient the agent at session start."
user-invocable: false
allowed-tools: Bash, Read
---

# Session Bootstrap

Run `work-kit bootstrap` to detect work-kit state.

## If active work exists

- Report current state to the user: slug, phase, step, status
- **If `knowledge` is present in the bootstrap output**, surface it to the agent and the user:
  - `knowledge.lessons` — project-specific learnings from prior sessions
  - `knowledge.conventions` — codified rules this project follows
  - `knowledge.risks` — fragile or dangerous areas to handle with care
  - `knowledge.decisions` — architectural choices made in past sessions (what was picked, what was rejected, why) — read this **before** proposing any choice that might re-litigate a settled one
  - Read each of these silently into your working context — they're prior knowledge you should respect when planning and building. Briefly mention to the user that prior knowledge was loaded (one line; do not dump the full text into the chat).
  - `workflow.md` is intentionally NOT loaded — it's a write-only artifact for human curators.
- If recovery is suggested: follow the recovery instruction
- Otherwise: run `work-kit run` to continue the workflow

## If no active work

- Inform the user that work-kit is available
- Available commands: `/full-kit <description>` or `/auto-kit <description>`
- Do not start work unprompted

## Capabilities to be aware of

- **Triage phase** — first phase, always runs. Classifies the request (bug-fix / small-change / refactor / feature / large-feature) and the CLI builds the workflow accordingly. Refine and Spec (formerly the Define phase) are now sub-steps inside Plan/Understand.
- **wk-debug** — auto-invoked when any step reports outcome `needs_debug`. You don't trigger it; the orchestrator does.
- **test/exercise** — fans out 3 parallel lens sub-agents internally (Verify, E2E, Browser). The Browser lens uses Chrome DevTools MCP; if the MCP isn't installed (doctor will warn at session start), the lens skips itself and the rest of Exercise still runs.
- **decisions in knowledge layer** — `## Decisions` bullets matching `**<context>**: chose X over Y — <why>` are auto-graduated to `.work-kit-knowledge/decisions.md` during wrap-up.
- **DDD discipline** — Plan models the domain (bounded contexts, aggregates, value objects, repository contracts); Build implements it (TDD inside `build/implement`).

## If session is stale

- Report the staleness warning to the user
- Run `work-kit status` to get full diagnostics
- If the state is recoverable, run `work-kit run` to resume
- If the state is corrupted, suggest starting fresh
