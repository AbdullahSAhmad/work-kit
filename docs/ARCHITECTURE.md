# Architecture

This is the canonical reference for how the work-kit CLI orchestrates a workflow. The CLI is the state machine; Claude Code is the agent runtime. They communicate through three things: a JSON state file, a Markdown notes file, and a typed action protocol.

If you are writing a new skill, fixing a routing bug, or building a feature that touches state, start here.

---

## Contents

1. [State](#state) — what `tracker.json` and `state.md` are responsible for, schema versioning, the Final-section handoff between phases.
2. [Action protocol](#action-protocol) — the closed set of actions the CLI returns to the orchestrator, and what each means.
3. [Receipts](#receipts) — the structured evidence each step writes, how outcomes derive from it, what the validator enforces.

---

## State

Every active session has a single source of truth on disk under `<worktree>/.work-kit/`:

| File | Format | Owner | Purpose |
|---|---|---|---|
| `tracker.json` | JSON | CLI | State machine — phases, steps, statuses, loopback log, classification, model policy |
| `state.md` | Markdown | Agents | Working notes — Description, Criteria, per-phase Final sections, Observations, Decisions, Deviations |
| `receipts/<phase>-<step>.json` | JSON | Agents | Per-step structured receipts the CLI uses to derive outcomes |
| `awaiting-input` | empty file | hooks | Marker that the agent is blocked on the user (cleared on any forward transition) |
| `idle` | empty file | hooks | Marker that the session is idle (cleared on any forward transition) |

The split is deliberate. **JSON enforces rules, Markdown carries knowledge.** The CLI never parses prose; agents never decide routing.

### `tracker.json` shape

Defined as `WorkKitState` in [`cli/src/state/schema.ts`](../cli/src/state/schema.ts). Current version: **4**.

Top-level fields:

- `version: 4` — schema version; readState migrates older versions before validating.
- `slug` — kebab-case identifier derived from the description.
- `branch` — git branch name (`feature/<slug>`).
- `started` — ISO timestamp the session began.
- `mode` — `"full-kit"` or `"auto-kit"`.
- `gated?` — when true, every phase boundary returns `wait_for_user` instead of auto-proceeding.
- `classification?` — `bug-fix | small-change | refactor | feature | large-feature` (auto-kit only; set at init or by `triage/classify`).
- `status` — `in-progress | paused | completed | failed`.
- `modelPolicy?` — session-wide model routing policy (`auto | opus | sonnet | haiku | inherit`).
- `pausedAt?` — ISO timestamp set on pause, deleted on resume.
- `currentPhase`, `currentStep` — pointer to where the workflow is sitting.
- `phases` — `Record<PhaseName, PhaseState>` with per-step status/outcome/timing.
- `workflow?` — auto-kit's dynamic step list (which steps were marked included vs skipped).
- `loopbacks` — append-only audit log of every loopback, including debug iterations (`kind: "debug"`).
- `metadata.worktreeRoot` and `metadata.mainRepoRoot` — absolute paths the CLI uses when crossing back into the main repo (archive writes, knowledge harvesting).

### Atomic writes and validation

Every write goes through `writeState` ([`cli/src/state/store.ts`](../cli/src/state/store.ts)): write to a randomly-suffixed temp file, then `rename` (atomic on POSIX). A partially-written tracker.json never exists at the canonical path.

Every read goes through `readState`: file → `JSON.parse` → `migrateState` (fields renamed from older versions) → `validateStateShape` (hand-rolled type guard at `state/store.ts:81`). Hand-edits or post-migration corruption surface as a single error listing every problem found, e.g.:

```
Invalid tracker.json at .work-kit/tracker.json:
  - version must be 4, got 3
  - mode must be "full-kit" or "auto-kit", got "fast"
```

The validator is intentionally lightweight (no Zod, no codegen) — it just enforces the WorkKitState shape so downstream code can trust its types.

### `state.md` and the Final-section handoff

Phases run in fresh agents — the Build agent doesn't carry Plan's investigation notes. The handoff happens through structured Markdown sections in `state.md`:

- Each phase writes `### <Phase>: Final` when it finishes.
- Some phases also write step-level sections (e.g. `### Plan: UX Flow`, `### Test: Verify`, `### Review: Scope`).
- The CLI's [`agent-map.ts`](../cli/src/config/agent-map.ts) records, per phase and per step, which sections need to be extracted into the next agent's prompt.

Top-level sections that persist for the whole session:

```
## Description       — original task description (Triage may refine; Plan reads)
## Criteria          — acceptance criteria (Plan/Understand writes; Test/Validate maps against)
## Observations      — typed bullets harvested into .work-kit-knowledge/ at wrap-up
## Decisions         — `**<context>**: chose X over Y — <why>` entries; routed to decisions.md
## Deviations        — implementation drift from the Blueprint; scratch-only
```

Observations grammar (parsed by `extractCommand`):

```
- [lesson|convention|risk|workflow|decision] text
- [workflow:phase/step] text     # workflow tag may include a phase/step locator
```

Decisions grammar (a stricter shape so the harvester can route them):

```
- **<context>**: chose <X> over <Y> — <why>
```

Lines that don't match are skipped, not errored. Deviations are scratch — never auto-harvested.

### Loopback log

`state.loopbacks` is append-only. Each record:

```json
{
  "from": { "phase": "plan", "step": "audit" },
  "to":   { "phase": "plan", "step": "design" },
  "reason": "Audit found gaps — revising Design",
  "timestamp": "2026-04-30T...",
  "kind": "standard"   // or "debug"
}
```

Two caps:
- **Standard loopbacks** — max 2 per route (`MAX_LOOPBACKS_PER_ROUTE` in [`constants.ts`](../cli/src/config/constants.ts)). On the third trigger, `complete` returns `wait_for_user` instead of looping.
- **Debug iterations** — max 2 per origin step (`MAX_DEBUG_ITERATIONS`). Tracked separately via `kind: "debug"`.

When a loopback fires, `resetToLocation` ([`state/helpers.ts`](../cli/src/state/helpers.ts)) marks the target step and everything after it back to `pending`, including downstream phases.

---

## Action protocol

The CLI returns a typed `Action` from every command. The orchestrator (full-kit / auto-kit skill) reads the action's `action` field and reacts. Definition lives at [`cli/src/state/schema.ts:188`](../cli/src/state/schema.ts).

The closed set:

| Action | When it fires | Key fields | Orchestrator behavior |
|---|---|---|---|
| `spawn_agent` | `next` resolves to a single step | `phase`, `step`, `skillFile`, `agentPrompt`, `onComplete`, `model?`, `receiptPath?` | Spawn an agent with the prompt; on completion run `onComplete` (always `work-kit complete <phase>/<step>`) |
| `spawn_parallel_agents` | `next` resolves to a parallel group (only when project config defines one — defaults are empty) | `agents[]`, `thenSequential?`, `onComplete` | Spawn all `agents` in a single message, await all, then spawn `thenSequential` if present, then run `onComplete` |
| `spawn_debug_agent` | `complete` receives a receipt with `error` field (or step-derived `needs_debug`) | `origin`, `iteration`, `skillFile`, `agentPrompt`, `onComplete`, `model?` | Spawn the wk-debug agent with the originating step's context; on completion run `work-kit next` and the originating step retries |
| `wait_for_user` | Phase boundary in gated mode; loopback or debug at cap; one-off "proceed?" prompts | `message` | Show message; do not advance until the user types something |
| `loopback` | `complete` triggers a loopback route | `from`, `to`, `reason` | Report the route to the user, then run `work-kit next` (the engine has already reset state) |
| `complete` | Last phase finishes, or status is already `completed` | `message` | Workflow is done — run wrap-up if not yet run |
| `paused` | `pause` succeeds | `message` | Stop the loop |
| `resumed` | `resume` succeeds | `message`, `phase`, `step`, `worktreeRoot?` | If `worktreeRoot` is in the message, `cd` there before continuing |
| `select_session` | `resume` finds multiple paused sessions | `message`, `sessions[]` | Show the list, ask the user to pick, then call `resume --slug <slug>` |
| `error` | Any command can fail | `message`, `suggestion?` | Surface to user; do not retry |

Every action is wrapped (success or fail) in JSON on stdout. Top-level CLI catches throws and converts them to `{ "action": "error", "message": ... }` via the `failJson` helper at [`cli/src/utils/errors.ts`](../cli/src/utils/errors.ts).

### `work-kit run` — the orchestrator driver

The orchestrator skill loops on a single command:

```bash
work-kit run                          # what's next?
work-kit run --finished plan/understand   # I just finished this — what's next?
```

`run` calls `complete` (when `--finished` is passed) and then `next`, returning the resulting action plus an `after` field with the bash to run **after** acting on the action. The orchestrator's job collapses to:

1. Run `work-kit run` (or `work-kit run --finished <last>`).
2. If action is `spawn_agent` or `spawn_parallel_agents` or `spawn_debug_agent`: spawn the agent(s), wait, loop with `--finished <phase>/<step>`.
3. If action is `wait_for_user` or `paused` or `select_session`: surface to user; stop or wait.
4. If action is `loopback`, `resumed`: re-run `work-kit run` (no `--finished`).
5. If action is `complete`: run wrap-up.
6. If action is `error`: surface and stop.

Routing decisions are pure functions of receipt fields and tracker state. The orchestrator has no judgment to apply — it executes.

---

## Receipts

A receipt is the structured evidence a step writes to `.work-kit/receipts/<phase>-<step>.json` before calling `complete`. Receipts replaced agent-chosen `--outcome` flags. The agent's job became filling out a form; outcomes are derived by the CLI as pure functions of receipt fields.

### Where they live

Schemas are defined in [`cli/src/receipts/schemas.ts`](../cli/src/receipts/schemas.ts). The store is at [`cli/src/receipts/store.ts`](../cli/src/receipts/store.ts). Validation runs in [`cli/src/receipts/validate.ts`](../cli/src/receipts/validate.ts) and outcome derivation in [`cli/src/receipts/derive.ts`](../cli/src/receipts/derive.ts).

The relative path emitted to agents is `.work-kit/receipts/<phase>-<step>.json`. The orchestrator passes it to the agent via the `receiptPath` field on the `spawn_agent` action.

### What goes in one

Every receipt extends `BaseReceipt`:

```typescript
{
  version: 1,
  step: "<phase>/<step>",
  timestamp: "<ISO>",
  notes?: string,
  error?: { kind: string, message: string, details?: unknown }
}
```

The presence of `error` always derives `needs_debug`, regardless of step.

Step-specific fields by category:

**Routing-relevant** (the CLI derives a non-trivial outcome):

| Step | Required fields | Derived outcome |
|---|---|---|
| `triage/classify` | `classification`, `signals` | `done` (and writes classification into state) |
| `plan/audit` | `gaps[]`, `deviations?` | `revise` if `gaps.length > 0`, else `done` |
| `build/implement` | `tests_passing`, `test_command` | `done` if tests pass, else `needs_debug` |
| `test/validate` | `criteria[]`, `verdict` | `done` if `verdict === "pass"`, else `revise` (no auto-route) |
| `review/resolve` | `ship_decision` | `approved` if `"approved"`, else `changes_requested` |
| `deploy/ship` | `merged`, `monitor_status` | `done` if merged + green/yellow; `fix_needed` if not merged or monitor red |

**Evidence-only** (always derive `done` unless `error` is set):

`plan/understand`, `plan/design`, `build/setup`, `build/commit`, `test/exercise`, `review/scope`, `review/review`, `wrap-up/finalize`.

### How outcomes drive routing

Outcomes are values from `STEP_OUTCOMES` ([`cli/src/state/schema.ts:83`](../cli/src/state/schema.ts)). Loopback routes are static (`LOOPBACK_ROUTES` in [`config/loopback-routes.ts`](../cli/src/config/loopback-routes.ts)):

```
plan/audit       + revise              → plan/design          (max 2)
review/resolve   + changes_requested   → build/implement       (max 2)
deploy/ship      + fix_needed          → build/implement       (max 2)
```

`needs_debug` is special: it doesn't use a static route. Instead, `complete` invokes wk-debug pointed at the originating step, and the step retries when wk-debug finishes (up to 2 iterations per origin).

### Validation contract

`validateReceipt` checks shape — required fields present, enums valid, types correct. If validation fails, `complete` returns an error action like:

```
Receipt for build/implement failed validation:
  - tests_passing must be boolean
  - test_command must be a string
```

…with a `suggestion` to fix the file and re-run. The receipt path is always echoed.

Steps without a schema (anything not in `RECEIPT_STEP_KEYS`) fall back to the agent's `--outcome` flag — but every current pipeline step has a schema, so that path is mostly historical.

---

## File map

If you're hunting for the implementation of something on this page:

```
cli/src/
  state/
    schema.ts        — types: WorkKitState, Action, StepOutcome, ...
    store.ts         — readState, writeState, migrateState, validateStateShape
    helpers.ts       — parseLocation, resetToLocation
    validators.ts    — phase prerequisite checks
  workflow/
    transitions.ts   — determineNextStep, isPhaseComplete
    loopbacks.ts     — checkLoopback, countLoopbacksForRoute
    parallel.ts      — getParallelGroup (defaults empty; project config opts in)
    gates.ts         — phase boundary gating
  receipts/
    schemas.ts       — Receipt union, RECEIPT_STEP_KEYS
    store.ts         — receiptPath, writeReceipt, readReceiptRaw
    validate.ts      — validateReceipt
    derive.ts        — deriveOutcome (pure function of validated receipt)
    resolve.ts       — read → validate → derive in one call
  config/
    workflow.ts      — PHASE_ORDER, PHASE_PREREQUISITES, WORKFLOW_MATRIX, buildDefaultWorkflow
    constants.ts     — caps, dir names, branch prefix
    agent-map.ts     — PHASE_CONTEXT, STEP_CONTEXT (sections to extract per agent)
    model-routing.ts — resolveModel (per-step tier resolution)
    loopback-routes.ts — LOOPBACK_ROUTES (static trigger → target)
  commands/
    init.ts          — create state, return first spawn
    next.ts          — what's next? (returns Action)
    complete.ts      — mark step done, derive outcome, route
    run.ts           — orchestrator driver (complete + next)
    ...              — bootstrap, status, validate, doctor, observe, ...
```
