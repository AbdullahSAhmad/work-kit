# Plan: TypeScript Orchestrator for work-kit

## Context

The work-kit workflow is currently 100% prompt-based — markdown skill files that Claude reads and follows on good faith. Nothing enforces phase prerequisites, validates transitions, manages structured state, or coordinates parallel agents. This leads to fragile orchestration where Claude can skip steps, lose context, or spawn agents incorrectly.

The goal is to add a **TypeScript CLI** that acts as the state machine controller, while keeping the existing .md skill files as instructions for each agent.

## Architecture

**Script handles:** State machine, validation, context extraction, agent instruction generation
**Claude handles:** Spawning agents, running skill instructions, writing code, user interaction

### Interaction Model

Claude calls the CLI via Bash. The CLI returns JSON telling Claude exactly what to do next.

```
Claude: npx work-kit-cli init --mode full --description "add user avatar"
  → { action: "spawn_agent", phase: "plan", skillFile: "...", agentPrompt: "..." }

Claude: (spawns Plan agent using Agent tool)

Claude: npx work-kit-cli complete plan --outcome done
  → { action: "wait_for_user", message: "Plan complete. Proceed?" }

Claude: npx work-kit-cli next
  → { action: "spawn_agent", phase: "build", ... }
```

### CLI Commands

| Command | Purpose |
|---------|---------|
| `work-kit init --mode <full\|auto> --description "<text>"` | Create worktree, initialize state |
| `work-kit next` | Get the next action (spawn agent, wait, loopback, complete) |
| `work-kit complete <phase>/<step> [--outcome <value>]` | Mark step done, validate transition |
| `work-kit status` | Current state summary |
| `work-kit context <phase>` | Extract Final sections needed for a phase's agent |
| `work-kit loopback --from <src> --to <target> --reason "<text>"` | Register loop-back |
| `work-kit validate <phase>` | Check prerequisites |
| `work-kit workflow [--add/--remove]` | auto-kit: manage dynamic checklist |

### Dual State: JSON + Markdown

- **`.work-kit/tracker.json`** — source of truth for the state machine (phases, transitions, outcomes)
- **`.work-kit/state.md`** — source of truth for content (Final sections, working notes, criteria)

JSON enforces rules. Markdown carries the knowledge. Both live in the worktree.

### Parallel Agent Coordination

Test and Review phases spawn parallel sub-agents that could race on writing to state.md. Solution: each parallel sub-agent writes to its own file:
- `.work-kit/test-verify.md`, `.work-kit/test-e2e.md`
- `.work-kit/review-self.md`, `.work-kit/review-security.md`, etc.

The sequential follow-up agent (Validate, Handoff) or the `complete` command merges them into state.md.

## File Structure

```
work-kit/
  src/
    index.ts                    # CLI entry (commander)
    commands/
      init.ts                   # Create worktree + state
      next.ts                   # Core state machine step
      complete.ts               # Mark done, check loopbacks
      status.ts                 # Print current state
      context.ts                # Extract Final sections
      loopback.ts               # Register loop-back
      validate.ts               # Check prerequisites
      workflow.ts               # auto-kit dynamic checklist
    state/
      schema.ts                 # All TypeScript interfaces
      store.ts                  # Read/write tracker.json, find worktree
      validators.ts             # Prerequisite checks
    engine/
      phases.ts                 # Phase definitions + step ordering
      transitions.ts            # State machine transition logic
      loopbacks.ts              # Loop-back route definitions
      agent-specs.ts            # Per-phase agent spawn specs
      parallel.ts               # Parallel sub-agent coordination
    context/
      extractor.ts              # Parse ### Final sections from state.md
      prompt-builder.ts         # Build agent prompts from skill files + context
    config/
      phases.ts                 # Static: phase order, steps, prerequisites
      loopback-routes.ts        # Static: trigger→target map
      agent-map.ts              # Static: which agent reads which sections
  package.json
  tsconfig.json
  .claude/skills/               # Existing, updated minimally
    full-kit.md                 # Updated to call CLI
    auto-kit.md                 # Updated to call CLI
    ...                         # Step files stay mostly the same
```

## Key Types

```typescript
// State
interface WorkKitState {
  version: 1;
  slug: string;
  branch: string;
  started: string;
  mode: "full-kit" | "auto-kit";
  classification?: "bug-fix" | "small-change" | "refactor" | "feature" | "large-feature";
  status: "in-progress" | "paused" | "completed" | "failed";
  currentPhase: PhaseName | null;
  currentStep: string | null;
  phases: Record<PhaseName, PhaseState>;
  workflow?: WorkflowStep[];      // auto-kit only
  loopbacks: LoopbackRecord[];
  metadata: { worktreeRoot: string; mainRepoRoot: string };
}

type PhaseName = "plan" | "build" | "test" | "review" | "deploy" | "wrap-up";

interface PhaseState {
  status: "pending" | "in-progress" | "complete" | "skipped";
  startedAt?: string;
  completedAt?: string;
  steps: Record<string, StepState>;
}

interface StepState {
  status: "pending" | "in-progress" | "complete" | "skipped";
  startedAt?: string;
  completedAt?: string;
  agentType: "single" | "parallel-sub" | "sequential-after-parallel";
  outcome?: string;
}

interface WorkflowStep {
  phase: PhaseName;
  step: string;
  included: boolean;
  completed: boolean;
}

interface LoopbackRecord {
  timestamp: string;
  from: { phase: PhaseName; step: string };
  to: { phase: PhaseName; step: string };
  reason: string;
  iteration: number;
}

// Actions returned by CLI
type Action =
  | { action: "spawn_agent"; phase: string; step: string; skillFile: string; agentPrompt: string; onComplete: string }
  | { action: "spawn_parallel_agents"; agents: AgentSpec[]; thenSequential?: AgentSpec; onComplete: string }
  | { action: "wait_for_user"; message: string }
  | { action: "loopback"; from: Location; to: Location; reason: string }
  | { action: "complete"; message: string }
  | { action: "error"; message: string; suggestion?: string }
```

## Static Configuration

### Phase Prerequisites

```typescript
const PHASE_PREREQUISITES: Record<PhaseName, PhaseName[]> = {
  "plan": [],
  "build": ["plan"],
  "test": ["build"],
  "review": ["test"],
  "deploy": ["review"],       // + handoff.outcome === "approved"
  "wrap-up": ["review"],      // OR ["deploy"] if deploy was included
};
```

### Step Order Per Phase

```typescript
const PHASE_STEPS: Record<PhaseName, string[]> = {
  "plan": ["clarify", "investigate", "sketch", "scope", "ux-flow", "architecture", "blueprint", "audit"],
  "build": ["setup", "migration", "red", "core", "ui", "refactor", "integration", "commit"],
  "test": ["verify", "e2e", "validate"],
  "review": ["self-review", "security", "performance", "compliance", "handoff"],
  "deploy": ["merge", "monitor", "remediate"],
  "wrap-up": [],
};
```

### Loop-back Routes

```typescript
const LOOPBACK_ROUTES = [
  { trigger: { phase: "plan", step: "audit", outcome: "revise" },
    target: { phase: "plan", step: "blueprint" }, maxIterations: 2 },
  { trigger: { phase: "build", step: "refactor", outcome: "broken" },
    target: { phase: "build", step: "core" }, maxIterations: 2 },
  { trigger: { phase: "review", step: "handoff", outcome: "changes_requested" },
    target: { phase: "build", step: "core" }, maxIterations: 2 },
  { trigger: { phase: "deploy", step: "merge", outcome: "fix_needed" },
    target: { phase: "build", step: "core" }, maxIterations: 2 },
  { trigger: { phase: "deploy", step: "remediate", outcome: "fix_and_redeploy" },
    target: { phase: "build", step: "core" }, maxIterations: 2 },
];
```

### Agent Context Map (what each phase agent reads from state.md)

```typescript
const AGENT_CONTEXT: Record<PhaseName, { sections: string[]; additional?: string }> = {
  "plan": { sections: ["## Description", "## Criteria"] },
  "build": { sections: ["### Plan: Final", "## Criteria"] },
  "test": { sections: ["### Build: Final", "### Plan: Final", "## Criteria"] },
  "review": { sections: ["### Plan: Final", "### Build: Final", "### Test: Final", "## Criteria"], additional: "git diff main...HEAD" },
  "deploy": { sections: ["### Review: Final", "### Build: Final"] },
  "wrap-up": { sections: ["*"] },  // reads full state.md
};
```

### Parallel Sub-agent Groups

```typescript
const PARALLEL_GROUPS = {
  "test": {
    parallel: ["verify", "e2e"],
    thenSequential: "validate",
    outputFiles: { "verify": ".work-kit/test-verify.md", "e2e": ".work-kit/test-e2e.md" },
  },
  "review": {
    parallel: ["self-review", "security", "performance", "compliance"],
    thenSequential: "handoff",
    outputFiles: {
      "self-review": ".work-kit/review-self.md",
      "security": ".work-kit/review-security.md",
      "performance": ".work-kit/review-perf.md",
      "compliance": ".work-kit/review-compliance.md",
    },
  },
};
```

## Implementation Phases

### Phase 1: Foundation
- `package.json`, `tsconfig.json` (tsx runner, no build step)
- `src/state/schema.ts` — all types
- `src/config/phases.ts` — static phase definitions
- `src/state/store.ts` — find worktree, read/write tracker.json
- `src/commands/init.ts` — create worktree + tracker.json + state.md
- `src/commands/status.ts` — read and print state

### Phase 2: Core State Machine
- `src/state/validators.ts` — prerequisite checks
- `src/engine/transitions.ts` — transition logic
- `src/commands/next.ts` — the core loop
- `src/commands/complete.ts` — mark done, detect loopbacks
- `src/commands/validate.ts`

### Phase 3: Context & Prompts
- `src/context/extractor.ts` — parse state.md for ### sections
- `src/context/prompt-builder.ts` — compose agent prompts
- `src/engine/agent-specs.ts` — what each agent needs
- `src/commands/context.ts`

### Phase 4: Parallel Agents
- `src/engine/parallel.ts` — parallel group definitions
- Update `next.ts` to return `spawn_parallel_agents`
- Parallel output file merging in `complete.ts`

### Phase 5: Loop-backs & Auto-kit
- `src/config/loopback-routes.ts`
- `src/engine/loopbacks.ts`
- `src/commands/loopback.ts`
- `src/commands/workflow.ts`

### Phase 6: Skill File Updates
- Update `full-kit.md` and `auto-kit.md` to use CLI
- Add outcome reporting to step files
- End-to-end testing

## Skill File Changes

The orchestrator skills (`full-kit.md`, `auto-kit.md`) get updated to call the CLI:

```markdown
## How to Execute

1. Run `npx work-kit-cli next` to get the next action
2. Parse the JSON response
3. Follow the action type:
   - "spawn_agent": Use the Agent tool with the provided agentPrompt
   - "spawn_parallel_agents": Spawn all agents in parallel, wait, then spawn thenSequential
   - "wait_for_user": Report message and stop
   - "loopback": Report to user, then run `npx work-kit-cli next`
   - "complete": Done — run wrap-up
   - "error": Report and stop
4. After each agent completes: `npx work-kit-cli complete <phase>/<step> --outcome <outcome>`
5. Then `npx work-kit-cli next` again
```

Step .md files stay the same, with one addition: each ends with "Report your outcome" instruction.

## Verification

1. `npx work-kit-cli init --mode full --description "test feature"` → creates worktree + tracker.json
2. `npx work-kit-cli next` → returns spawn_agent for plan/clarify
3. `npx work-kit-cli complete plan/clarify` → advances to plan/investigate
4. `npx work-kit-cli validate build` → returns error (plan not complete)
5. Complete all plan steps → `npx work-kit-cli next` returns wait_for_user
6. `npx work-kit-cli next` → returns spawn_agent for build/setup
7. Test parallel: complete build → test phase returns spawn_parallel_agents with verify+e2e
8. Test loopback: `work-kit complete review/handoff --outcome changes_requested` → returns loopback action

## Dependencies

- `commander` — CLI argument parsing
- `tsx` — run TypeScript directly without build step
- `typescript` — type checking
- `@types/node` — Node.js type definitions

No other runtime dependencies. Uses only Node built-ins for file I/O, path resolution, and child process execution.

---

# Addendum: v0.5 — Define phase, Debug recovery, ADRs, Browser verify

Inspired by a comparison against [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills). Their model is 19 small, single-purpose skills across the SDLC. Our model is one cohesive pipeline. This addendum imports the most useful gaps **without** shattering the pipeline:

1. A new **Define** phase before Plan (idea-refine + spec drafting).
2. A new **wk-debug** triage skill for recovery when Build/Test/Review fails.
3. A new **wk-adr** capability to formalize Decisions as ADRs (hooks into existing two-layer knowledge persistence).
4. A new **Browser verify** step inside `wk-test`, backed by a single configurable driver (Playwright **or** Chrome DevTools MCP), chosen at `setup` time.

Out of scope for v0.5 (deferred): extracting `wk-security`/`wk-perf`/`wk-simplify` as standalone skills. Per user, we keep Review composed for now.

## Guiding constraints

- **No regressions to existing sessions.** Every addition is additive. The current full-kit / auto-kit / classification matrix must keep working unchanged when Define is skipped.
- **Single source of truth stays.** `tracker.json` + `state.md` remain the only state. Define writes to a new `### Define: Final` section; Debug writes loopback breadcrumbs into the existing `loopbacks` array.
- **Skill structure mirrors existing phases.** `skills/wk-define/SKILL.md` + `steps/*.md`, exactly like `wk-plan`.
- **Driver choice is project-level config**, not session-level. Stored once in project config (where `model-routing.ts` and friends live), so a frontend project doesn't have to re-pick every session.

## 1. Define phase (new)

### Purpose
Convert a vague idea into a concrete spec **before** Plan/Clarify wastes investigation effort on the wrong target. Today, fuzzy asks survive Clarify because Clarify only has the user's one-line description to work with. Define gives Plan a real artifact to clarify against.

### Steps
1. **refine** — Take the raw description, surface ambiguity, propose 1–3 framings. Ask the user to pick or correct. Output: a tightened problem statement.
2. **spec** — Turn the tightened statement into a lightweight PRD: goal, non-goals, users, success signal, constraints. Not architecture (that's Plan).

Two steps only. Resist the urge to add more — Define must stay cheap or auto-kit will skip it.

### Files to add
```
skills/wk-define/SKILL.md
skills/wk-define/steps/refine.md
skills/wk-define/steps/spec.md
```
Mirror the structure of `skills/wk-plan/SKILL.md` exactly.

### State.md output
A new top-level section:
```markdown
### Define: Final

**Verdict:** ready

**Problem:** <tightened statement>

**Spec:**
- Goal: <one sentence>
- Non-goals: <bullets>
- Users: <who>
- Success signal: <how we know it worked>
- Constraints: <bullets>
```
Plan/Clarify reads this if present, falls back to `## Description` if not.

### CLI / config changes

**`cli/src/state/schema.ts`**
- Add `"define"` to `PHASE_NAMES` as the **first** entry: `["define", "plan", "build", "test", "review", "deploy", "wrap-up"]`.
- Add `DEFINE_STEPS = ["refine", "spec"] as const` and corresponding type, and entry in `STEPS_BY_PHASE`.
- Bump `WorkKitState.version` from `2` to `3`. Add a migration in `state/store.ts` that, on read of a v2 tracker, injects an empty `define` phase with `status: "skipped"` so old sessions resume cleanly.

**`cli/src/config/workflow.ts`**
- Add `PHASE_PREREQUISITES.define = null` and change `PHASE_PREREQUISITES.plan = "define"`. **But:** prerequisite check must treat `status: "skipped"` as satisfied. Confirm that's already true in `state/validators.ts` before relying on it — if not, fix there.
- Extend `WORKFLOW_MATRIX` with `define/refine` and `define/spec` rows for each classification:
  - `bug-fix`, `small-change`, `refactor`: both `skip`
  - `feature`: both `YES`
  - `large-feature`: both `YES`
- This is the key safety property: existing classifications **skip Define by default**, so auto-kit behavior is unchanged for the common cases.

**`cli/src/config/agent-map.ts`**
- Add `define: { sections: ["## Description"] }` to `PHASE_CONTEXT`.
- Update `plan: { sections: ["## Description", "### Define: Final", "## Criteria"] }` so Plan sees the spec when present. The extractor already tolerates missing sections.

**`full-kit/SKILL.md` and `auto-kit/SKILL.md`**
- No code logic change — they call `next` and obey the JSON. But the human-facing description should mention Define so users understand the new first phase.

### Loopback
- `define/spec` outcome `revise` → loop back to `define/refine`. Add to `loopback-routes.ts`. Max 2 iterations (consistent with existing routes).

### Risks & mitigations
- **Risk:** Define becomes a tax on small changes. **Mitigation:** workflow matrix skips it for bug-fix/small-change/refactor by default.
- **Risk:** Plan agents that hardcode "## Description only" miss the spec. **Mitigation:** change is in `agent-map.ts` only; `prompt-builder` already iterates the sections array.

> Note on schema versioning: per user direction, no backwards compatibility for v0.5. Bump `WorkKitState.version` to `3` and update fixtures; **no migration code**, no v2 fallback. Any in-flight v2 sessions must be cancelled or completed before upgrading.

## 2. wk-debug recovery skill (new)

### Purpose
Pipeline currently assumes forward motion. When Build/Test/Review hits an error the agent doesn't know what to do, it spirals — retries, hacks, or surrenders. `wk-debug` is a focused triage skill that can be invoked **mid-pipeline** without ending the session.

### Shape
A standalone skill (`skills/wk-debug/SKILL.md`) with no sub-steps. It is **not** a phase. It's a side-skill the orchestrator invokes automatically when a step reports outcome `needs_debug`. **Not user-invocable** — per user directive, no new commands beyond the default kits. Debug fires from inside the pipeline, not from a slash command.

Five-step triage methodology (from addyosmani's `debugging-and-error-recovery`, adapted):
1. **Reproduce** — confirm the failure deterministically.
2. **Isolate** — minimal failing case, identify the boundary.
3. **Hypothesize** — list candidate causes ranked by likelihood.
4. **Test** — make the cheapest hypothesis-killing observation first.
5. **Fix or escalate** — apply fix, OR write a clear escalation with what's known and unknown.

The skill writes its findings to `.work-kit/debug-<timestamp>.md` and appends a `[risk] debug: <summary>` to `## Observations` so wrap-up/knowledge can capture it.

### CLI changes (Option A — confirmed)
- New outcome `needs_debug` in `STEP_OUTCOMES`.
- Extend `LoopbackRoute` in `loopback-routes.ts` with an optional `dynamic: "return_to_origin"` field. When set, the engine resolves `to` at runtime from the originating step recorded on the loopback. This preserves the CLI-as-state-machine invariant.
- New route: any step + `needs_debug` → spawn `wk-debug` agent → on completion (`outcome: done`) return to the originating step for a retry. Max 2 debug invocations per origin step before forcing `blocked` and surfacing to the user.
- `next.ts` learns to spawn the `wk-debug` agent. Treat it like any other agent spawn but pointed at `skills/wk-debug/SKILL.md` with the originating step's context.

### Risks
- **Risk:** Debug becomes a hiding place — agents loop forever in triage instead of finishing. **Mitigation:** max 2 debug invocations per step before forcing `blocked` and surfacing to user.
- **Risk:** Outcome enum churn. **Mitigation:** `needs_debug` is purely additive; no existing code branches on the absence of it.

## 3. Decisions as a first-class knowledge type (merged with existing knowledge layer)

### Purpose
We already capture `## Decisions` in `state.md` per session, and `wrap-up/knowledge` routes typed observations into `.work-kit-knowledge/{lessons,conventions,risks,workflow}.md`. But **decisions currently die with the worktree** — `work-kit extract` deliberately ignores them (per `wk-wrap-up/steps/knowledge.md` line 22, they're agent scratch space).

The fix: rather than building a parallel `docs/adr/` system, **add `decision` as a fifth knowledge type** and teach `work-kit extract` to route `## Decisions` entries into `.work-kit-knowledge/decisions.md`. Same machinery, same lockfile, same secret redaction, same idempotency. No new command surface area.

### Why merge instead of separate ADRs
- The knowledge layer already solves dedup, redaction, atomic appends, stable file format, and manual-section preservation. Building Nygard ADRs in parallel would duplicate all of that.
- One mental model for the user: "things worth remembering across sessions live in `.work-kit-knowledge/`." Decisions are just one more file there.
- Zero new commands (per user directive: keep commands limited to default kits).
- Addy's ADR pattern is for projects with no structured capture; ours already has it — we just need to *stop throwing the decisions away*.

### What changes

**`cli/src/commands/extract.ts`**
- Currently parses `## Observations` only. Extend it to also parse `## Decisions` and route each entry to `decisions.md`.
- Format in `state.md` stays human-friendly:
  ```markdown
  ## Decisions
  - **Auth provider**: chose Auth0 over Cognito — Cognito's UI customization gaps cost more long-term.
  - **Browser driver**: chose Chrome DevTools MCP over Playwright — agentic style, no spec files to maintain.
  ```
- Each bullet becomes one entry in `decisions.md`. The leading `**Context**:` becomes the title; the rest is the rationale. Bullets that don't match the documented shape are skipped (not errors).

**`cli/src/commands/learn.ts`**
- Add `decision` to the accepted `--type` values, alongside `lesson|convention|risk|workflow`.
- Routes to `.work-kit-knowledge/decisions.md`.

**`.work-kit-knowledge/decisions.md`** (auto-created on first use)
- Same structure as the other knowledge files: append-only auto-generated section, plus a `## Manual` section below for human curation that tooling never touches.
- Entry shape, kept minimal — NOT full Nygard, just enough to remember why:
  ```markdown
  ### YYYY-MM-DD — <title>
  <one or two sentences: what was chosen, what was rejected, why>
  _Source: <session-slug>_
  ```

**`skills/wk-wrap-up/steps/knowledge.md`**
- Update line 22's "## Decisions and ## Deviations are not auto-harvested" warning. Decisions ARE now harvested. (Deviations stay scratch.)
- Update the table at line 44 to add the `decision` row.
- Update the `learn` examples to include a `--type decision` example.

**`skills/wk-plan/SKILL.md` and `wk-plan/steps/architecture.md`**
- The shape `**<context>**: chose X over Y — <why>` is already documented at `wk-plan/SKILL.md` line 38. The extract parser will depend on it. Add an explicit example in `architecture.md` so agents don't drift from the format.

### What does NOT change
- No `docs/adr/` directory. No Nygard format. No new command. No new wrap-up sub-step.
- `WRAPUP_STEPS` stays `["summary", "knowledge"]`.
- `wrap-up/knowledge` is the only step touched, and only its instructions change — no structural change to the phase.

### Risks
- **Risk:** Extraction picks up junk decisions written before the format was enforced. **Mitigation:** the parser only routes bullets matching `**<context>**: chose X over Y — <why>`. Free-form lines are skipped, not errored. Agents will tighten over time as the boundary update lands.
- **Risk:** Decisions file grows unbounded over a long-lived project. **Mitigation:** same as the existing `lessons.md` / `risks.md` — append-only is fine, rotation/curation is a manual concern via the `## Manual` section. Not a v0.5 problem.

---

## 4. Browser verify step inside wk-test

### Purpose
`wk-test/verify` runs the test suite. It does not exercise the running app. For UI work this is a real gap — passing unit tests + green build can still ship a broken page. addyosmani has `browser-testing-with-devtools` for this.

### Shape
**Not a new phase.** A new step inside `wk-test`:
```
test/verify     (unchanged — runs test suite)
test/browser    (NEW — exercises the running app via the configured driver)
test/e2e        (existing)
test/validate   (existing)
```
The new step is `included: "if UI"` in the workflow matrix — same gating as existing UI-conditional steps. So bug-fix on a Go service never sees it.

### Driver: Chrome DevTools MCP (confirmed)

Per user: Chrome DevTools MCP, hardcoded. Not a runtime switch, not configurable per project.
- The agent drives a real browser via MCP tools — no `*.spec.ts` files to maintain, no `playwright.config.ts` per project, matches the agentic style of the rest of work-kit.
- Requires the Chrome DevTools MCP server installed in the user's Claude Code environment. `wk-bootstrap` documents the install. The CLI's `setup`/`doctor` command emits a warning (not an error) if the MCP isn't reachable, so a project without UI work can still run the rest of the pipeline.

### CLI changes
- Add `"browser"` between `verify` and `e2e` in `TEST_STEPS`.
- Workflow matrix: `test/browser: "if UI"` for `feature` and `large-feature`, `skip` elsewhere.
- `doctor.ts`: probe Chrome DevTools MCP availability with a no-op call; surface a warning, don't block.
- `agent-map.ts`: `"test/browser": { sections: ["### Build: Final", "## Criteria", "### Plan: UX Flow"] }`.
- Parallel groups (`engine/parallel.ts` or wherever the test parallelism lives — confirm during step F): browser is sequential after verify, before e2e. Don't parallelize browser with e2e — they may compete for the same dev server port.

### Skill file
`skills/wk-test/steps/browser.md` — instructs the agent to:
1. Start the dev server (or assume it's running per project config).
2. Use the configured driver to load each user-facing flow from `### Plan: UX Flow`.
3. Verify each acceptance criterion that has a UI manifestation.
4. Capture screenshots/console errors to `.work-kit/test-browser/`.
5. Output `### Test: Browser` with verdict.

### Risks
- **Risk:** Dev server lifecycle is messy (port conflicts, hot reload). **Mitigation:** project config field `devServer: { command, port, healthCheck }`. The skill respects it. If absent, the skill prompts the user once per session.
- **Risk:** MCP availability varies by user. **Mitigation:** graceful skip with a clear "install MCP X to enable browser verify" message — the rest of the pipeline proceeds.

## Cross-cutting changes

### `wk-bootstrap/SKILL.md`
Mention Define phase, Chrome DevTools MCP requirement for browser verify, and the new `needs_debug` outcome so the bootstrap orientation reflects v0.5.

### `README.md` and `CHANGELOG.md`
- README: add the four additions under "What's new in v0.5" and update the phase list.
- CHANGELOG: standard entry. Bump `package.json` to `0.5.0`.

### Tests to add
- Extend `cli/src/commands/init.test.ts` to assert Define phase is initialized but skipped for non-feature classifications.
- Extend `cli/src/commands/learn.test.ts` for the new `decision` type.
- New tests for `extract.ts` covering `## Decisions` parsing (positive + the "skip free-form lines" path).
- New `cli/src/config/workflow.test.ts` if not present — assert each classification's Define + browser inclusion.

No migration tests, no backwards-compat fixtures — v0.5 is a clean line per user direction.

## Resolved decisions (locked in)

| # | Question | Answer |
|---|---|---|
| 1 | Debug loopback model | **Option A** — engine extension with `dynamic: "return_to_origin"` |
| 2 | Browser driver | **Chrome DevTools MCP**, hardcoded |
| 3 | ADR system | **Merged into knowledge layer** — `decision` becomes a 5th type in `.work-kit-knowledge/decisions.md`. No separate ADR files, no new commands. |
| 4 | Define gating | **feature + large-feature only** by default |
| 5 | Schema versioning | Bump to `version: 3`, **no migration code, no v2 fallback** (clean line) |
| 6 | New user-invocable commands | **None** — wk-debug and decision-capture both fire from inside the pipeline. Default kits (full-kit, auto-kit, pause/resume/cancel/bootstrap, release) stay the only user-facing entry points. |

## Implementation order (approved — ready to start)

A) **Schema** — bump `WorkKitState.version` to 3, add `define` to `PHASE_NAMES`, add `DEFINE_STEPS`, add `needs_debug` to `STEP_OUTCOMES`, add `"browser"` to `TEST_STEPS`. No migration code.

B) **Static config** — `workflow.ts` matrix updates (Define gating, browser gating), `loopback-routes.ts` (define/spec→refine, dynamic return_to_origin route for needs_debug), `agent-map.ts` (define context, plan reads `### Define: Final`, test/browser sections).

C) **`skills/wk-define/`** — `SKILL.md` + `steps/refine.md` + `steps/spec.md`. Mirror `wk-plan` structure.

D) **`skills/wk-debug/`** — `SKILL.md` with the 5-step triage methodology. Engine support in `next.ts` to spawn debug agents and resolve `return_to_origin` on completion. Max-2-iterations guard.

E) **Decisions in knowledge layer** — extend `extract.ts` parser, add `decision` type to `learn.ts`, update `wk-wrap-up/steps/knowledge.md` instructions and table, add format example to `wk-plan/steps/architecture.md`.

F) **`skills/wk-test/steps/browser.md`** + Chrome DevTools MCP probe in `doctor.ts` + `wk-bootstrap` mention. Confirm test phase parallel/sequential ordering during this step.

G) **Docs + version bump** — README, CHANGELOG, package.json → 0.5.0. No release until all of A–F are merged.

A blocks everything. B depends on A. C, D, E, F are independent after B and can land in any order or in parallel.
