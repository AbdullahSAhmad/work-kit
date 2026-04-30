# work-kit

Structured development workflow for [Claude Code](https://claude.com/claude-code). Two modes, 7 phases, 13 steps, plus auto-debug recovery — orchestrated by a TypeScript CLI with reusable skill files. **DDD-disciplined** end-to-end (Plan models the domain; Build implements it).

## What's new

- **Structured receipts + `work-kit run`** — every step now writes a JSON receipt that the CLI validates and derives the step outcome from. Agents no longer pick `--outcome` flags. The orchestrator loop collapses to a single `work-kit run` driver: it tells you what agent to spawn and what bash to run after it. Routing decisions are pure functions of receipt fields, not free-form model calls.
- **Triage phase** replaces Define as the first phase. One step (Classify) — picks the work class (bug-fix / small-change / refactor / feature / large-feature), and the CLI builds the workflow. Refine and Spec moved into Plan/Understand.
- **Review/Triage step renamed to Review/Scope** to disambiguate from the new front Triage.
- **DDD discipline** baked into Plan and Build — bounded contexts, aggregates, value objects, repository contracts in Plan; TDD-implemented cleanly inside `build/implement`.
- **Build collapsed to 3 steps** — Setup (branch + deps + migrations), Implement (full TDD cycle internally: Red → Core → UI → Refactor → Integration), Commit.
- **Plan collapsed to 3 steps** — Understand (refine + spec for features, then criteria + investigation), Design, Audit.
- **wk-debug** triage skill auto-fires when any step reports `needs_debug`, then the originating step retries (max 2 iterations). Not user-invocable.
- **Test collapsed to 2 steps** — Exercise (fans out 3 parallel lens sub-agents internally: Verify, E2E, Browser) and Validate (criteria mapping + verdict). Browser lens drives the running app via Chrome DevTools MCP and skips gracefully if the MCP isn't installed.
- **Decisions** matching `**<context>**: chose X over Y — <why>` auto-graduate into `.work-kit-knowledge/decisions.md` at wrap-up.

## Installation

**One-step setup** (recommended):

```bash
npx work-kit-cli setup
```

This auto-detects Claude Code projects in your workspace and installs the skill files. If multiple projects are found, it lists them for you to choose.

**Global install**:

```bash
npm install -g work-kit-cli
```

## Quick start

```bash
# 1. Set up work-kit in your project
npx work-kit-cli setup

# 2. In Claude Code, start a workflow
/full-kit add user avatar upload    # strict, all phases
/auto-kit fix login redirect bug    # dynamic, only needed stages
```

## Modes

### `/full-kit <description>`

Runs every phase and step in strict order. No shortcuts.

Best for: large features, new systems, maximum rigor.

### `/auto-kit <description>`

Classifies the request (bug-fix, small-change, refactor, feature, large-feature) and builds a dynamic workflow with only the steps needed.

Best for: bug fixes, small changes, refactors, well-understood tasks.

## CLI commands

| Command | Description |
|---------|-------------|
| `init <description>` | Initialize a new workflow with a task description |
| `run` | Skinny orchestrator driver — returns the next imperative action with the bash to run after it. The orchestrator skill loops on this. |
| `run --finished <phase>/<step>` | Mark a step finished (reads its receipt, derives the outcome) and return the next action |
| `next` | Advance to the next step (low-level — `run` wraps this) |
| `complete` | Mark a step complete (low-level — `run` wraps this) |
| `status` | Show current workflow state (phase, step, progress) |
| `context` | Generate context summary for the current phase |
| `validate` | Validate state integrity and phase prerequisites |
| `loopback` | Route back to a previous stage (max 2 per route) |
| `workflow` | Display the full workflow plan |
| `pause` | Pause the active session (state preserved on disk) |
| `resume [--slug <slug>]` | Without `--slug`: list resumable sessions in this repo. With `--slug`: resume the named session |
| `observe [--all]` | Live TUI dashboard of active/paused/completed sessions. `--all` watches every work-kit project on the system |
| `doctor` | Run environment health checks (supports `--json`) |
| `setup` | Install work-kit skills into a Claude Code project |

### Picking up where you left off

`work-kit resume` (or `/resume-kit` in Claude Code) scans every worktree of the current repo for `.work-kit/tracker.json` files in `paused` or `in-progress` state and lets you pick one. It works from the main repo root — no need to `cd` into a worktree first. In-progress sessions are listed too, so a terminal you closed without pausing can be recovered: just look for the row with a stale `lastUpdatedAgoMs`.

### Watching multiple projects

`work-kit observe --all` discovers every work-kit-enabled repo from your `~/.claude/projects/` history and watches them all in one dashboard. Each row shows the project name, work item slug, mode, type, current state, and worktree.

## Phases

| Phase | Steps | Agent |
|-------|-----------|-------|
| **Triage** | Classify | Single (always — picks the work class) |
| **Plan** | Understand (refine + spec + criteria + investigate), Design, Audit | Single (DDD-disciplined) |
| **Build** | Setup, Implement, Commit | Single (Implement runs the full TDD cycle internally, DDD-disciplined) |
| **Test** | Exercise, Validate | Exercise (fans out 3 parallel lens sub-agents internally: Verify, E2E, Browser) → Validate (criteria mapping + verdict) |
| **Review** | Scope, Review, Resolve | Scope → Review (fans out 4 parallel reviewer sub-agents internally: Quality, Efficiency, Security, Compliance) → Resolve (fix + ship decision) |
| **Deploy** | Ship | Single (optional — runs pre-flight, merge, monitor, remediate as one autonomous flow) |
| **Wrap-up** | Summary, Knowledge | Single |

## Architecture

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the canonical reference — state files, the action protocol, and the receipt schema. The summary below is a tour.

### Context management

Each phase runs as a **fresh agent**. The Build agent doesn't carry Plan's investigation notes — no context bloat.

Phases communicate through **Final sections** in `.work-kit/state.md`. Each phase writes a `### <Phase>: Final` section that the next phase reads.

### State management

Dual state files in `.work-kit/`:

- **tracker.json** — state machine (current phase, step, transitions, loop-back counts)
- **state.md** — content (working notes, Final sections, accumulated context)

All writes are atomic to prevent state corruption.

### Parallel agents

- **Test phase**: Exercise fans out 3 parallel lens sub-agents (Verify, E2E, Browser) using the Agent tool, then Validate runs sequentially to map criteria and produce the verdict
- **Review phase**: Scope classifies the diff, then Review fans out 4 parallel reviewer sub-agents (Quality, Efficiency, Security, Compliance) using the Agent tool, then Resolve aggregates findings, fixes aggressively, and makes the ship decision

### Loop-back routing

Any stage can route back to a previous stage. Each route is enforced with a max count of 2 to prevent infinite loops.

### Validation

- **full-kit**: phase-level prerequisites (Plan before Build before Test...)
- **auto-kit**: step-level validation against the `## Workflow` checklist
- Both modes refuse to skip ahead

### Output

```
.work-kit-tracker/
  index.md                              # log of all completed work (links to summaries + archives)
  archive/
    avatar-upload-2026-04-03/
      state.md                          # full phase outputs
      tracker.json                      # full JSON tracker (phases, timing, status)
      summary.md                        # distilled wrap-up summary
```

## Repo structure

```
work-kit/
  cli/
    src/
      commands/       # CLI command implementations
      config/         # Configuration and defaults
      context/        # Context generation for phases
      engine/         # Workflow engine and transitions
      state/          # State machine and file management
      index.ts        # Entry point
  skills/
    full-kit/SKILL.md       # /full-kit orchestrator (all phases, strict order)
    auto-kit/SKILL.md       # /auto-kit orchestrator (dynamic, only needed steps)
    wk-bootstrap/SKILL.md   # /wk-bootstrap session detection
    wk-triage/SKILL.md      # Triage phase runner (1 step: classify)
    wk-triage/steps/        # 1 step file: classify
    wk-plan/SKILL.md        # Plan phase runner
    wk-plan/steps/          # 3 step files: understand (refine+spec+criteria+investigate), design, audit
    wk-build/SKILL.md       # Build phase runner
    wk-build/steps/         # 3 step files: setup, implement, commit
    wk-test/SKILL.md        # Test phase runner
    wk-test/steps/          # 2 step files: exercise (3 parallel lens sub-agents internally), validate
    wk-review/SKILL.md      # Review phase runner
    wk-review/steps/        # 3 step files: scope, review (4 parallel lens sub-agents internally), resolve
    wk-deploy/SKILL.md      # Deploy phase runner
    wk-deploy/steps/        # 1 step file: ship (pre-flight + merge + monitor + remediate)
    wk-wrap-up/SKILL.md     # Wrap-up: summary + knowledge harvest
    wk-wrap-up/steps/       # 2 step files: summary, knowledge
    wk-debug/SKILL.md       # Auto-debug triage (not user-invocable)
    pause-kit/SKILL.md      # /pause-kit — pause active session
    resume-kit/SKILL.md     # /resume-kit — resume paused session
    cancel-kit/SKILL.md     # /cancel-kit — cancel and clean up session
  package.json
```

## Requirements

- Node.js >= 18
- Git
- [Claude Code](https://claude.com/claude-code)
